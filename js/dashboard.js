import { supabase } from './config/supabaseClient.js';

const itemsGrid = document.getElementById('items-grid');
const itemsStatus = document.getElementById('items-status');
const adminPanelLink = document.getElementById('admin-panel-link');

const categoryLabels = {
  livros: 'Livros & Apontamentos',
  tecnologia: 'Tecnologia & Eletrónica',
  material: 'Material Académico',
  outros: 'Outros'
};

const wearLabels = {
  novo: 'Novo',
  como_novo: 'Como novo',
  bom: 'Bom',
  usado: 'Usado',
  muito_usado: 'Muito usado',
  satisfatorio: 'Satisfatório'
};

function formatPrice(value) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return 'Preço indisponível';
  }

  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  }).format(number);
}

function getPrimaryImage(item) {
  const images = item.item_image || [];
  const primary = images.find((image) => image.is_principal);
  return primary?.image_url || images[0]?.image_url || '../assets/icons/logo.svg';
}

function getCategoryLabel(item) {
  const categoryName = item.categoria?.name;

  if (!categoryName) return 'Sem categoria';
  return categoryName;
}

function getWearLabel(value) {
  return wearLabels[value] || value || 'Sem estado';
}

function createBadge(text) {
  return `<span class="badge">${text}</span>`;
}

function renderEmptyState(message) {
  if (!itemsGrid) return;

  itemsGrid.innerHTML = `
    <div class="app-alert app-alert--neutral app-alert--center">${message}</div>
  `;
}

function renderItems(items) {
  if (!itemsGrid) return;

  if (!items.length) {
    renderEmptyState('Ainda não existem anúncios publicados.');
    return;
  }

  itemsGrid.innerHTML = items.map((item) => {
    const imageUrl = getPrimaryImage(item);
    const categoryLabel = getCategoryLabel(item);
    const wearLabel = getWearLabel(item.wear_status);

    return `
      <a class="item-card" href="item.html?id=${item.id}">
        <div class="item-card__media">
          <img src="${imageUrl}" alt="${item.title || 'Anúncio'}">
        </div>
        <div class="item-card__body">
          <h2 class="item-card__title">${item.title || 'Sem título'}</h2>
          <p class="item-card__text">${item.description || 'Sem descrição disponível.'}</p>
          <div class="badge-list">
            ${createBadge(categoryLabel)}
            ${createBadge(wearLabel)}
          </div>
          <p class="detail-price" style="font-size: 1.1rem;">${formatPrice(item.price)}</p>
        </div>
      </a>
    `;
  }).join('');
}

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
      created_at,
      category_id,
      item_image ( image_url, is_principal )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar anúncios:', error);
    itemsStatus.textContent = 'Não foi possível carregar os anúncios.';
    renderEmptyState('Erro ao carregar os anúncios.');
    return;
  }

  itemsStatus.textContent = data.length ? `A mostrar ${data.length} anúncio${data.length === 1 ? '' : 's'}.` : 'Sem anúncios para mostrar.';
  // Load category names for items that have category_id set
  const categoryIds = Array.from(new Set(data.map((it) => it.category_id).filter(Boolean)));
  let categoryMap = {};
  if (categoryIds.length) {
    const { data: cats, error: catsErr } = await supabase.from('categoria').select('id,name').in('id', categoryIds);
    if (!catsErr && cats) {
      categoryMap = cats.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});
    }
  }

  // Attach categoria object expected by renderItems
  const enhanced = data.map((it) => ({ ...it, categoria: it.category_id ? { name: categoryMap[it.category_id] } : null }));

  renderItems(enhanced);
}

async function loadAdminLink() {
  if (!adminPanelLink) return;

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return;

  const { data: profile, error } = await supabase
    .from('utilizador')
    .select('is_admin')
    .eq('id', authData.user.id)
    .single();

  if (!error && profile?.is_admin) {
    adminPanelLink.hidden = false;
  }
}

if (itemsGrid && itemsStatus) {
  loadItems();
}

async function renderAdminButton() {
    try {

        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) return;


        const { data: profile, error } = await supabase
            .from('utilizador')
            .select('is_admin')
            .eq('id', authData.user.id)
            .single();

        if (error) throw error;

        if (profile?.is_admin) {
            const adminPanelLink = document.getElementById('admin-panel-link');
            if (adminPanelLink) {
                adminPanelLink.innerHTML = '<a id="admin-btn" class="app-btn app-btn--soft" href="admin.html">Painel admin</a>';
            }
        }
    } catch (error) {
        console.error('Erro ao verificar estatuto de admin:', error);
    }
}

renderAdminButton();

loadAdminLink();
