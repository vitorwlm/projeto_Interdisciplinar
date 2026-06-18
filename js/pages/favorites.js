/*
 * favorites.js — Página de favoritos do utilizador.
 *
 * Mostra todos os anúncios que o utilizador guardou como favoritos e
 * permite removê-los individualmente.
 *
 * Porquê duas queries em vez de um JOIN?
 *   1ª query: tabela "favorito" → obtemos os IDs dos itens favoritos.
 *   2ª query: tabela "item" com filtro ".in('id', itemIds)" → buscamos
 *   os detalhes apenas dos itens relevantes.
 *
 *   Um JOIN equivalente também funcionaria, mas esta abordagem é mais
 *   explícita e facilita o tratamento de erros em cada etapa.
 */

import { supabase } from '../config/supabaseClient.js';
import { initPage, getCurrentUser, removeFavorite, renderItemCard, plural } from '../utils/utils.js';

await initPage();

const favoritesGrid = document.getElementById('favorites-grid');
const favoritesStatus = document.getElementById('favorites-status');


/* ── Render ──────────────────────────────────────────────────────────────── */

/*
 * renderEmpty — Mostra a mensagem de estado vazio quando não há favoritos.
 * Ocupa toda a largura da grid com "grid-column: 1 / -1" para que a mensagem
 * fique centrada independentemente do número de colunas.
 */
function renderEmpty() {
  if (!favoritesGrid) return;
  favoritesGrid.innerHTML = '<div class="alert alert--neutral alert--center" style="grid-column: 1 / -1;">Ainda não adicionaste nenhum favorito.</div>';
}

/*
 * renderFavorites — Desenha os cartões dos itens favoritos.
 *
 * Usa "removable: true" para que renderItemCard mostre um botão
 * "Remover dos favoritos" no rodapé em vez do ícone de coração —
 * mais explícito neste contexto.
 */
function renderFavorites(items) {
  if (!favoritesGrid) return;

  if (!items.length) {
    renderEmpty();
    return;
  }

  favoritesGrid.innerHTML = items.map((item) => renderItemCard(item, { removable: true })).join('');

  const botoes = favoritesGrid.querySelectorAll('[data-remove-fav]');
  botoes.forEach((btn) => {
    btn.addEventListener('click', () => removerFavorito(btn));
  });

  updateStatusCount();
}

/*
 * updateStatusCount — Atualiza o contador de favoritos na barra de estado.
 *
 * Conta os botões "[data-remove-fav]" que existem no DOM em vez de usar
 * uma variável separada, garantindo que o número reflete sempre o que está
 * visível na página.
 */
function updateStatusCount() {
  if (!favoritesGrid || !favoritesStatus) return;

  const count = favoritesGrid.querySelectorAll('[data-remove-fav]').length;
  favoritesStatus.textContent = count > 0 ? plural(count, 'favorito') + '.' : '';
}


/* ── Remover favorito ────────────────────────────────────────────────────── */

/*
 * removerFavorito — Remove um item dos favoritos e recarrega a lista.
 *
 * Porquê recarregar toda a lista em vez de apenas remover o card do DOM?
 *   Recarregar garante que a lista está sempre sincronizada com a base de
 *   dados. Remover só do DOM poderia deixar a UI inconsistente se a operação
 *   na BD falhasse silenciosamente.
 */
async function removerFavorito(btn) {
  const itemId = btn.dataset.removeFav;

  btn.disabled = true;
  btn.textContent = 'A remover...';

  const user = await getCurrentUser();
  if (!user) return;

  const { error } = await removeFavorite(user.id, itemId);

  if (error) {
    console.error('Erro ao remover favorito:', error);
    btn.disabled = false;
    btn.textContent = 'Remover dos favoritos';
    return;
  }

  loadFavorites();
}


/* ── Carregar favoritos ──────────────────────────────────────────────────── */

async function loadFavorites() {
  if (!favoritesGrid || !favoritesStatus) return;

  favoritesStatus.textContent = 'A carregar favoritos...';

  const user = await getCurrentUser();
  if (!user) return;

  const { data: favRows, error: favError } = await supabase
    .from('favorito')
    .select('item_id')
    .eq('user_id', user.id);

  if (favError) {
    console.error('Erro ao carregar favoritos:', favError);
    favoritesStatus.textContent = 'Não foi possível carregar os favoritos.';
    return;
  }

  if (!favRows || favRows.length === 0) {
    favoritesStatus.textContent = '';
    renderEmpty();
    return;
  }

  const itemIds = favRows.map((row) => row.item_id);

  /*
   * Buscar os detalhes dos itens favoritos numa única query com ".in()"
   * em vez de N queries individuais — muito mais eficiente.
   * A ordenação por "created_at" descendente mostra os anúncios mais
   * recentes primeiro, independentemente da ordem em que foram favoritados.
   */
  const { data: items, error: itemsError } = await supabase
    .from('item')
    .select('id, title, description, price, wear_status, seller_id, item_image(image_url, is_principal)')
    .in('id', itemIds)
    .order('created_at', { ascending: false });

  if (itemsError) {
    console.error('Erro ao carregar itens favoritos:', itemsError);
    favoritesStatus.textContent = 'Não foi possível carregar os favoritos.';
    return;
  }

  /*
   * Buscar os nomes dos vendedores numa única query (.in) para mostrar
   * "Vendedor: X" em cada cartão de favorito.
   */
  const lista = items || [];
  const sellerIds = [...new Set(lista.map((i) => i.seller_id).filter(Boolean))];
  if (sellerIds.length) {
    const { data: sellers } = await supabase.from('utilizador').select('id,name').in('id', sellerIds);
    const sellerMap = {};
    (sellers || []).forEach((u) => { sellerMap[u.id] = u.name; });
    lista.forEach((i) => { i.sellerName = sellerMap[i.seller_id] || ''; });
  }

  renderFavorites(lista);
}

loadFavorites();
