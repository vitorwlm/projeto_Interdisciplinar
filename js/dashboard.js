import { supabase } from './config/supabaseClient.js';

const itemsGrid = document.getElementById('items-grid');
const itemsStatus = document.getElementById('items-status');

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
  return `<span class="tag is-light is-medium">${text}</span>`;
}

function renderEmptyState(message) {
  if (!itemsGrid) return;

  itemsGrid.innerHTML = `
    <div class="column is-12">
      <div class="notification is-light has-text-centered">
        ${message}
      </div>
    </div>
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
      <div class="column is-12-mobile is-6-tablet is-4-desktop">
        <a class="card is-block has-text-dark" href="item.html?id=${item.id}">
          <div class="card-image">
            <figure class="image is-4by3">
              <img src="${imageUrl}" alt="${item.title || 'Anúncio'}">
            </figure>
          </div>
          <div class="card-content">
            <div class="content">
              <p class="title is-5 mb-2">${item.title || 'Sem título'}</p>
              <p class="mb-3">${item.description || 'Sem descrição disponível.'}</p>
              <div class="tags mb-3">
                ${createBadge(categoryLabel)}
                ${createBadge(wearLabel)}
              </div>
              <p class="title is-6 has-text-primary mb-0">${formatPrice(item.price)}</p>
            </div>
          </div>
        </a>
      </div>
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

if (itemsGrid && itemsStatus) {
  loadItems();
}
