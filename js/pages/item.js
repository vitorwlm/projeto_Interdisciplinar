/*
 * item.js — Página de detalhe de um anúncio individual.
 *
 * O ID do anúncio é passado via query string: item.html?id=<uuid>
 *
 * Conteúdo da página:
 *   • Imagem principal e galeria de imagens adicionais.
 *   • Título, descrição, preço, categoria, estado e vendedor.
 *   • Ações disponíveis conforme o utilizador:
 *       - Dono do anúncio → botões Editar e Apagar.
 *       - Outro utilizador → botão Comprar (ou estado do anúncio).
 *       - Qualquer utilizador → botão de favorito.
 */

import { supabase } from '../config/supabaseClient.js';
import {
  initPage,
  getCurrentUser,
  addFavorite,
  removeFavorite,
  buyItem,
  deleteItemImages,
  renderNotice,
  renderImageGrid,
  formatPrice,
  getWearLabel,
  getPrimaryImage
} from '../utils/utils.js';

await initPage();

const titleEl = document.getElementById('listing-title');
const imageEl = document.getElementById('listing-image');
const descriptionEl = document.getElementById('listing-description');
const priceEl = document.getElementById('listing-price');
const categoryEl = document.getElementById('listing-category');
const conditionEl = document.getElementById('listing-condition');
const sellerEl = document.getElementById('listing-seller');
const statusEl = document.getElementById('listing-status');
const galleryEl = document.getElementById('listing-gallery');

function renderError(message) {
  renderNotice(statusEl, message, 'danger', false);
}

/*
 * loadItem — Carrega e renderiza todos os dados de um anúncio.
 *
 * Porquê fazer queries separadas para categoria e vendedor?
 *   O Supabase suporta joins com select aninhado, mas carregar as relações
 *   em queries separadas é mais legível e permite tratar erros
 *   individualmente sem bloquear a renderização dos dados principais.
 */
async function loadItem() {
  const params = new URLSearchParams(window.location.search);
  const itemId = params.get('id');

  if (!itemId) {
    renderError('Não foi indicado nenhum anúncio.');
    return;
  }

  if (statusEl) statusEl.textContent = 'A carregar anúncio...';

  const { data, error } = await supabase
    .from('item')
    .select(`
      id,
      title,
      description,
      price,
      wear_status,
      sell_status,
      created_at,
      category_id,
      seller_id,
      item_image ( image_url, is_principal )
    `)
    .eq('id', itemId)
    .single();

  if (error || !data) {
    console.error('Erro ao carregar detalhe do anúncio:', error);
    renderError('Não foi possível carregar este anúncio.');
    return;
  }

  const images = data.item_image || [];
  const primaryImage = getPrimaryImage(data);
  const wearLabel = getWearLabel(data.wear_status);

  let categoryData = null;
  let sellerData = null;

  if (data.category_id) {
    const categoryResult = await supabase.from('categoria').select('name').eq('id', data.category_id).single();
    categoryData = categoryResult.data;
  }

  if (data.seller_id) {
    const sellerResult = await supabase.from('utilizador').select('name, university').eq('id', data.seller_id).single();
    sellerData = sellerResult.data;
  }

  const categoryName = (categoryData && categoryData.name) || 'Sem categoria';
  const sellerName = (sellerData && sellerData.name) || 'Vendedor desconhecido';
  const sellerUniversity = (sellerData && sellerData.university) || '';

  if (titleEl) titleEl.textContent = data.title || 'Sem título';
  if (imageEl) {
    imageEl.src = primaryImage;
    imageEl.alt = data.title || 'Anúncio';
  }
  if (descriptionEl) descriptionEl.textContent = data.description || 'Sem descrição disponível.';
  if (priceEl) priceEl.textContent = formatPrice(data.price);
  if (categoryEl) categoryEl.textContent = categoryName;
  if (conditionEl) conditionEl.textContent = wearLabel;

  /*
   * Mostrar "Nome · Universidade" se a universidade existir, ou apenas
   * o nome — formato condicional para não mostrar " · " desnecessário.
   */
  if (sellerEl) sellerEl.textContent = sellerUniversity ? `${sellerName} · ${sellerUniversity}` : sellerName;
  if (statusEl) statusEl.textContent = 'Anúncio carregado.';

  /*
   * A galeria mostra apenas as imagens NÃO marcadas como principal,
   * porque a imagem principal já aparece em destaque acima da galeria.
   */
  const extraImages = images.filter((image) => !image.is_principal);
  renderImageGrid(galleryEl, extraImages, 'gallery-tile', data.title || 'Anúncio', 'Sem fotografias adicionais.');

  const currentUser = await getCurrentUser();

  if (currentUser) {
    const isOwner = currentUser.id === data.seller_id;

    if (isOwner) {
      /*
       * O dono vê os botões de editar e apagar — escondidos por defeito
       * no HTML e revelados aqui com "hidden = false" para que utilizadores
       * sem sessão não os vejam de todo.
       */
      const ownerActions = document.getElementById('owner-actions');
      const editBtn = document.getElementById('edit-listing-btn');
      const deleteBtn = document.getElementById('delete-listing-btn');

      if (ownerActions) ownerActions.hidden = false;
      if (editBtn) editBtn.href = `edit.html?id=${data.id}`;

      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => deleteItem(data.id, deleteBtn));
      }
    } else {
      initBuyButton(data);
    }

    initFavButton(data.id, currentUser.id);
  }
}


/* ── Comprar ──────────────────────────────────────────────────────────────── */

/*
 * initBuyButton — Configura o botão de compra com base no estado do anúncio.
 *
 * Se o anúncio já foi vendido/reservado, mostra uma nota informativa em vez
 * do botão — o utilizador percebe que já não pode comprar sem precisar de
 * tentar e receber um erro.
 */
function initBuyButton(data) {
  const buyAction = document.getElementById('buy-action');
  const buyBtn = document.getElementById('buy-listing-btn');
  const soldNote = document.getElementById('sold-note');

  const available = (data.sell_status || 'disponivel') === 'disponivel';

  if (!available) {
    if (soldNote) {
      soldNote.textContent = data.sell_status === 'reservado'
        ? 'Este anúncio está reservado.'
        : 'Este anúncio já foi vendido.';
      soldNote.hidden = false;
    }
    return;
  }

  if (!buyAction || !buyBtn) return;
  buyAction.hidden = false;

  buyBtn.addEventListener('click', async () => {
    buyBtn.disabled = true;
    buyBtn.textContent = 'A processar...';

    const ok = await buyItem(data.id);
    if (ok) {
      buyAction.hidden = true;
      if (soldNote) {
        soldNote.textContent = 'Compra registada. O anúncio está agora vendido.';
        soldNote.hidden = false;
      }
    } else {
      buyBtn.disabled = false;
      buyBtn.textContent = 'Comprar';
    }
  });
}


/* ── Apagar anúncio ───────────────────────────────────────────────────────── */

/*
 * deleteItem — Apaga um anúncio e todos os seus dados associados.
 *
 * Ordem de eliminação deliberada:
 *   1. Imagens (Storage + registos item_image) — devem ser apagadas antes
 *      do item para evitar ficheiros órfãos no Storage.
 *   2. Favoritos — registos que referenciam o item_id devem ser apagados
 *      antes do item para respeitar as foreign keys da BD.
 *   3. Item — só apagado no fim, quando já não tem dependentes.
 */
async function deleteItem(itemId, btn) {
  if (!confirm('Tens a certeza que queres apagar este anúncio? Esta ação não pode ser desfeita.')) return;

  btn.disabled = true;
  btn.textContent = 'A apagar...';

  try {
    await deleteItemImages(itemId);
    await supabase.from('favorito').delete().eq('item_id', itemId);

    const { error } = await supabase.from('item').delete().eq('id', itemId);
    if (error) throw error;

    window.location.replace('dashboard.html');
  } catch (err) {
    console.error('Erro ao apagar anúncio:', err);
    btn.disabled = false;
    btn.textContent = 'Apagar anúncio';
  }
}


/* ── Favorito ─────────────────────────────────────────────────────────────── */

/*
 * initFavButton — Inicializa o botão de favorito verificando o estado atual
 * na base de dados.
 *
 * Porquê verificar a BD em vez de usar o array de favoriteIds do dashboard?
 *   Esta página pode ser acedida diretamente (link partilhado) sem passar
 *   pelo dashboard, pelo que não temos garantia de ter a lista de favoritos
 *   em memória. Verificar diretamente na BD é mais fiável.
 */
async function initFavButton(itemId, userId) {
  const btn = document.getElementById('fav-listing-btn');
  const icon = document.getElementById('fav-listing-icon');
  const label = document.getElementById('fav-listing-label');
  if (!btn) return;

  const { data: existing } = await supabase
    .from('favorito')
    .select('item_id')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle();

  let isFavorite = !!existing;
  updateFavButton(btn, icon, label, isFavorite);

  btn.addEventListener('click', async () => {
    btn.disabled = true;

    if (isFavorite) {
      const { error } = await removeFavorite(userId, itemId);
      if (!error) {
        isFavorite = false;
        updateFavButton(btn, icon, label, isFavorite);
      }
    } else {
      const { error } = await addFavorite(userId, itemId);
      if (!error) {
        isFavorite = true;
        updateFavButton(btn, icon, label, isFavorite);
      }
    }

    btn.disabled = false;
  });
}

/*
 * updateFavButton — Atualiza o visual do botão de favorito sem recarregar a página.
 *
 * Manipulamos os atributos do SVG diretamente (fill/stroke) em vez de trocar
 * o innerHTML para preservar a referência ao elemento DOM e evitar flickering.
 */
function updateFavButton(btn, icon, label, isFavorite) {
  if (isFavorite) {
    icon.setAttribute('fill', 'currentColor');
    icon.removeAttribute('stroke');
    btn.style.color = '#e53e3e';
    if (label) label.textContent = 'Remover dos favoritos';
    btn.setAttribute('aria-label', 'Remover dos favoritos');
  } else {
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    btn.style.color = '';
    if (label) label.textContent = 'Guardar nos favoritos';
    btn.setAttribute('aria-label', 'Adicionar aos favoritos');
  }
}

loadItem();
