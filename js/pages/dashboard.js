/*
 * dashboard.js — Página principal: lista de todos os anúncios disponíveis.
 *
 * Responsabilidades:
 *   • Mostrar todos os anúncios publicados (do mais recente para o mais antigo).
 *   • Permitir ao utilizador favoritar/desfavoritar qualquer anúncio.
 *   • Permitir comprar anúncios de outros utilizadores.
 *   • Mostrar o link para o painel de admin se o utilizador tiver permissão.
 */

import { supabase } from '../config/supabaseClient.js';
import {
  initPage,
  getCurrentUser,
  getFavoriteIds,
  addFavorite,
  removeFavorite,
  renderItemCard,
  renderNotice,
  buyItem,
  plural,
  unique,
  HEART_FILLED,
  HEART_OUTLINE
} from '../utils/utils.js';

/*
 * "await initPage()" bloqueia a execução até ao guarda de autenticação
 * terminar. Se não houver sessão, o utilizador é redirecionado para o login
 * e o restante código não chega a correr.
 */
await initPage();

const itemsGrid = document.getElementById('listings-grid');
const itemsStatus = document.getElementById('listings-status');
const adminPanelLink = document.getElementById('admin-panel-link');

/*
 * currentUserId e favoriteIds são variáveis de módulo (estado global desta
 * página) porque são consultadas em vários eventos (renderItems, toggleFavorite).
 * Iniciam vazias e são preenchidas em loadUserData().
 */
let currentUserId = null;
let favoriteIds = [];

/*
 * allItems guarda todos os anúncios carregados, para que a pesquisa possa
 * filtrar localmente (sem ir à base de dados a cada tecla).
 */
let allItems = [];

function renderEmptyState(message) {
  renderNotice(itemsGrid, message, 'neutral', true);
}

/*
 * renderItems — Desenha a grelha de cartões com os anúncios recebidos.
 *
 * Porquê ligar os eventos DEPOIS de fazer innerHTML?
 *   O innerHTML substitui todo o conteúdo anterior, destruindo quaisquer
 *   event listeners previamente ligados. Por isso, os botões são ligados
 *   sempre após a re-renderização.
 */
function renderItems(items) {
  if (!itemsGrid) return;

  if (!items.length) {
    renderEmptyState('Ainda não existem anúncios publicados.');
    return;
  }

  itemsGrid.innerHTML = items.map((item) =>
    renderItemCard(item, {
      showCategory: true,
      isFavorite: favoriteIds.includes(item.id),
      showBuy: true,
      currentUserId: currentUserId
    })
  ).join('');

  const favBtns = itemsGrid.querySelectorAll('[data-fav-item]');
  favBtns.forEach((btn) => {
    btn.addEventListener('click', () => toggleFavorite(btn));
  });

  const buyBtns = itemsGrid.querySelectorAll('[data-buy-item]');
  buyBtns.forEach((btn) => {
    btn.addEventListener('click', () => comprar(btn));
  });
}

/*
 * toggleFavorite — Adiciona ou remove um anúncio dos favoritos do utilizador.
 *
 * Porquê atualizar "favoriteIds" localmente em vez de recarregar da BD?
 *   Recarregar toda a lista de favoritos após cada clique seria muito lento
 *   e desnecessário. Mantemos o array local sincronizado manualmente e
 *   atualizamos apenas o visual do botão afetado — resposta imediata para
 *   o utilizador.
 *
 * O botão é desativado durante o pedido para evitar cliques duplos rápidos
 * que causariam duplicados na base de dados.
 */
async function toggleFavorite(btn) {
  if (!currentUserId) return;

  const itemId = btn.dataset.favItem;
  const jaEFavorito = favoriteIds.includes(itemId);

  btn.disabled = true;

  if (jaEFavorito) {
    const { error } = await removeFavorite(currentUserId, itemId);
    if (!error) {
      favoriteIds = favoriteIds.filter((id) => id !== itemId);
      btn.classList.remove('fav-btn--active');
      btn.innerHTML = HEART_OUTLINE;
      btn.setAttribute('aria-label', 'Adicionar aos favoritos');
    }
  } else {
    const { error } = await addFavorite(currentUserId, itemId);
    if (!error) {
      favoriteIds.push(itemId);
      btn.classList.add('fav-btn--active');
      btn.innerHTML = HEART_FILLED;
      btn.setAttribute('aria-label', 'Remover dos favoritos');
    }
  }

  btn.disabled = false;
}

/*
 * comprar — Inicia a compra de um anúncio e recarrega a lista em caso de
 * sucesso para refletir o novo estado ("Vendido").
 */
async function comprar(btn) {
  btn.disabled = true;
  btn.textContent = 'A processar...';

  const ok = await buyItem(btn.dataset.buyItem);
  if (ok) {
    loadItems();
  } else {
    btn.disabled = false;
    btn.textContent = 'Comprar';
  }
}

/*
 * loadItems — Carrega todos os anúncios da base de dados.
 *
 * Porquê fazer duas queries (itens + categorias) em vez de um JOIN?
 *   O Supabase suporta joins, mas buscar as categorias numa segunda query
 *   com filtro "IN" é mais eficiente quando há muitos anúncios com poucas
 *   categorias diferentes: buscamos cada categoria uma única vez em vez de
 *   a repetir em cada linha do resultado.
 *
 * A lista é ordenada por "created_at" descendente para que os anúncios
 * mais recentes apareçam primeiro.
 */
async function loadItems() {
  if (!itemsGrid || !itemsStatus) return;

  itemsStatus.textContent = 'A carregar anúncios...';

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
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar anúncios:', error);
    itemsStatus.textContent = 'Não foi possível carregar os anúncios.';
    renderEmptyState('Erro ao carregar os anúncios.');
    return;
  }

  itemsStatus.textContent = data.length
    ? 'A mostrar ' + plural(data.length, 'anúncio') + '.'
    : 'Sem anúncios para mostrar.';

  const categoryIds = unique(data.map((it) => it.category_id).filter(Boolean));
  const categoryMap = {};
  if (categoryIds.length) {
    const { data: cats } = await supabase.from('categoria').select('id,name').in('id', categoryIds);
    if (cats) {
      cats.forEach((c) => { categoryMap[c.id] = c.name; });
    }
  }

  data.forEach((it) => {
    it.categoria = it.category_id ? { name: categoryMap[it.category_id] } : null;
  });

  /*
   * Buscar os nomes dos vendedores numa única query (.in), tal como as
   * categorias, para mostrar "Vendedor: X" em cada cartão.
   */
  const sellerIds = unique(data.map((it) => it.seller_id).filter(Boolean));
  const sellerMap = {};
  if (sellerIds.length) {
    const { data: sellers } = await supabase.from('utilizador').select('id,name').in('id', sellerIds);
    if (sellers) {
      sellers.forEach((u) => { sellerMap[u.id] = u.name; });
    }
  }
  data.forEach((it) => { it.sellerName = sellerMap[it.seller_id] || ''; });

  allItems = data;
  populateCategoryFilter();
  renderItems(data);
}

/* ── Pesquisa + Filtros ─────────────────────────────────────────────────── */

const byId = (id) => document.getElementById(id);

/*
 * applyFilters — Filtra localmente allItems combinando a pesquisa por texto
 * com os filtros (categoria, estado, preço mín/máx, só disponíveis) e
 * volta a desenhar a grelha. Tudo no cliente, sem pedidos à BD.
 */
function applyFilters() {
  const termo = (byId('search') ? byId('search').value : '').trim().toLowerCase();
  const cat = byId('filter-category') ? byId('filter-category').value : '';
  const cond = byId('filter-condition') ? byId('filter-condition').value : '';
  const min = parseFloat(byId('filter-min') ? byId('filter-min').value : '');
  const max = parseFloat(byId('filter-max') ? byId('filter-max').value : '');
  const onlyAvail = byId('filter-available') ? byId('filter-available').checked : false;

  const filtrados = allItems.filter((it) => {
    if (termo) {
      const texto = [
        it.title || '',
        it.description || '',
        (it.categoria && it.categoria.name) || '',
        it.sellerName || ''
      ].join(' ').toLowerCase();
      if (!texto.includes(termo)) return false;
    }
    if (cat && String(it.category_id) !== cat) return false;
    if (cond && it.wear_status !== cond) return false;

    const preco = Number(it.price);
    if (!Number.isNaN(min) && (Number.isNaN(preco) || preco < min)) return false;
    if (!Number.isNaN(max) && (Number.isNaN(preco) || preco > max)) return false;

    if (onlyAvail && (it.sell_status || 'disponivel') !== 'disponivel') return false;
    return true;
  });

  /*
   * Ordenação:
   *   recent      → ordem original (já vem da BD por created_at desc)
   *   price-asc   → preço menor primeiro
   *   price-desc  → preço maior primeiro
   */
  const sort = byId('filter-sort') ? byId('filter-sort').value : 'recent';
  let resultado = filtrados;
  if (sort === 'price-asc') {
    resultado = [...filtrados].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  } else if (sort === 'price-desc') {
    resultado = [...filtrados].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  }

  if (!resultado.length) {
    renderEmptyState('Nenhum anúncio corresponde aos filtros.');
  } else {
    renderItems(resultado);
  }
}

/*
 * populateCategoryFilter — Preenche o <select> de categorias do painel de
 * filtros com as categorias presentes nos anúncios carregados.
 */
function populateCategoryFilter() {
  const sel = byId('filter-category');
  if (!sel) return;

  const vistas = new Set();
  const opcoes = [];
  allItems.forEach((it) => {
    if (it.category_id && it.categoria && it.categoria.name && !vistas.has(it.category_id)) {
      vistas.add(it.category_id);
      opcoes.push({ id: it.category_id, name: it.categoria.name });
    }
  });
  opcoes.sort((a, b) => a.name.localeCompare(b.name));

  sel.innerHTML = '<option value="">Todas</option>' +
    opcoes.map((o) => '<option value="' + o.id + '">' + o.name + '</option>').join('');
}

/*
 * initFilters — Liga a pesquisa, os campos de filtro, o botão de mostrar/
 * esconder o painel e o "Limpar filtros".
 */
function initFilters() {
  const form = byId('search-form');
  const search = byId('search');
  const toggle = byId('filter-toggle');
  const panel = byId('filters-panel');
  const clear = byId('filter-clear');

  /* Evita que carregar Enter na pesquisa recarregue a página. */
  if (form) form.addEventListener('submit', (e) => e.preventDefault());
  if (search) search.addEventListener('input', applyFilters);

  ['filter-sort', 'filter-category', 'filter-condition', 'filter-min', 'filter-max', 'filter-available'].forEach((id) => {
    const el = byId(id);
    if (el) el.addEventListener('input', applyFilters);
  });

  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      const vaiAbrir = panel.hasAttribute('hidden');
      if (vaiAbrir) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', String(vaiAbrir));
    });
  }

  if (clear) {
    clear.addEventListener('click', () => {
      ['filter-category', 'filter-condition', 'filter-min', 'filter-max'].forEach((id) => {
        const el = byId(id);
        if (el) el.value = '';
      });
      const av = byId('filter-available');
      if (av) av.checked = false;
      const so = byId('filter-sort');
      if (so) so.value = 'recent';
      if (search) search.value = '';
      applyFilters();
    });
  }
}

/*
 * loadUserData — Carrega os dados do utilizador autenticado.
 *
 * Porquê correr primeiro antes de loadItems()?
 *   Precisamos do currentUserId e dos favoriteIds ANTES de desenhar os cartões,
 *   para que os corações apareçam no estado correto desde o início.
 *   Se corressem em paralelo, os cartões podiam ser desenhados sem saber
 *   quais estão favoritados.
 */
async function loadUserData() {
  const user = await getCurrentUser();
  if (!user) return;

  currentUserId = user.id;
  favoriteIds = await getFavoriteIds(currentUserId);

  /*
   * Verifica o campo "is_admin" na tabela utilizador para decidir se mostra
   * o link para o painel de administração. Esta verificação é feita no
   * cliente apenas para esconder/mostrar o botão — a proteção real da página
   * admin está em admin.js (que verifica o mesmo campo no servidor).
   */
  if (adminPanelLink) {
    const { data: profile } = await supabase
      .from('utilizador')
      .select('is_admin')
      .eq('id', currentUserId)
      .single();

    if (profile && profile.is_admin) {
      adminPanelLink.innerHTML = '<a class="btn btn--soft" href="admin.html">Painel admin</a>';
    }
  }
}

/*
 * Sequência de inicialização:
 *   1. loadUserData — preenche currentUserId e favoriteIds.
 *   2. loadItems    — desenha os cartões já com os favoritos marcados.
 *
 * loadItems não usa "await" porque não depende do seu resultado para nada.
 */
await loadUserData();
loadItems();
initFilters();
