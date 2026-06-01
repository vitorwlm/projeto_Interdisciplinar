import { supabase } from './config/supabaseClient.js';

const titleEl = document.getElementById('item-title');
const imageEl = document.getElementById('item-image');
const descriptionEl = document.getElementById('item-description');
const priceEl = document.getElementById('item-price');
const categoryEl = document.getElementById('item-category');
const conditionEl = document.getElementById('item-condition');
const sellerEl = document.getElementById('item-seller');
const statusEl = document.getElementById('item-status');
const galleryEl = document.getElementById('item-gallery');

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

function renderError(message) {
  if (statusEl) {
    statusEl.innerHTML = `<div class="app-alert app-alert--danger">${message}</div>`;
  }
}

function renderGallery(images, title) {
  if (!galleryEl) return;

  if (!images.length) {
    galleryEl.innerHTML = `
      <div class="app-alert app-alert--neutral app-alert--center">Sem fotografias adicionais.</div>
    `;
    return;
  }

  galleryEl.innerHTML = images.map((image) => `
    <div class="gallery-tile">
      <img src="${image.image_url}" alt="${title}">
    </div>
  `).join('');
}

async function loadItem() {
  const params = new URLSearchParams(window.location.search);
  const itemId = params.get('id');

  if (!itemId) {
    renderError('Não foi indicado nenhum anúncio.');
    return;
  }

  if (statusEl) {
    statusEl.textContent = 'A carregar anúncio...';
  }

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
  const wearLabel = wearLabels[data.wear_status] || data.wear_status || 'Sem estado';

  const [{ data: categoryData }, { data: sellerData }] = await Promise.all([
    data.category_id
      ? supabase.from('categoria').select('name').eq('id', data.category_id).single()
      : Promise.resolve({ data: null }),
    data.seller_id
      ? supabase.from('utilizador').select('name, university, avatar_url').eq('id', data.seller_id).single()
      : Promise.resolve({ data: null })
  ]);

  const categoryName = categoryData?.name || 'Sem categoria';
  const sellerName = sellerData?.name || 'Vendedor desconhecido';
  const sellerUniversity = sellerData?.university || '';

  if (titleEl) titleEl.textContent = data.title || 'Sem título';
  if (imageEl) {
    imageEl.src = primaryImage;
    imageEl.alt = data.title || 'Anúncio';
  }
  if (descriptionEl) descriptionEl.textContent = data.description || 'Sem descrição disponível.';
  if (priceEl) priceEl.textContent = formatPrice(data.price);
  if (categoryEl) categoryEl.textContent = categoryName;
  if (conditionEl) conditionEl.textContent = wearLabel;
  if (sellerEl) sellerEl.textContent = sellerUniversity ? `${sellerName} · ${sellerUniversity}` : sellerName;
  if (statusEl) statusEl.textContent = 'Anúncio carregado.';

  renderGallery(images.filter((image) => !image.is_principal), data.title || 'Anúncio');
}

loadItem();
