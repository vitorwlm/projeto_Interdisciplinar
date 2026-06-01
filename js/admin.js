import { supabase } from './config/supabaseClient.js';

const adminStatus = document.getElementById('admin-status');
const metricItems = document.getElementById('metric-items');
const metricCategories = document.getElementById('metric-categories');
const metricAvailable = document.getElementById('metric-available');
const metricClosed = document.getElementById('metric-closed');
const metricUsers = document.getElementById('metric-users');
const categoryForm = document.getElementById('category-form');
const categoryNameInput = document.getElementById('category-name');
const categoryIconInput = document.getElementById('category-icon');
const categoryFormTitle = document.getElementById('category-form-title');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const categoriesList = document.getElementById('categories-list');
const reviewsList = document.getElementById('reviews-list');
const reviewStatus = document.getElementById('review-status');
const reviewSearch = document.getElementById('review-search');
const statusFilter = document.getElementById('status-filter');
const usersList = document.getElementById('users-list');
const usersStatus = document.getElementById('users-status');
const activeCategoryFilter = document.getElementById('active-category-filter');
const activeCategoryName = document.getElementById('active-category-name');
const clearCategoryFilterBtn = document.getElementById('clear-category-filter');

const wearLabels = {
  novo: 'Novo',
  como_novo: 'Como novo',
  bom: 'Bom',
  usado: 'Usado',
  muito_usado: 'Muito usado',
  satisfatorio: 'Satisfatório'
};

const sellStatusLabels = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  vendido: 'Vendido'
};

let cachedItems = [];
let cachedCategories = [];
let cachedUsers = [];
let categoryMap = {};
let sellerMap = {};
let selectedCategoryId = null;

function formatPrice(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 'Preço indisponível';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(number);
}

function getPrimaryImage(item) {
  const images = item.item_image || [];
  const primary = images.find((image) => image.is_principal);
  return primary?.image_url || images[0]?.image_url || '../assets/icons/logo.svg';
}

function getCategoryName(item) {
  if (item.categoria?.name) return item.categoria.name;
  if (item.category_id && categoryMap[item.category_id]) return categoryMap[item.category_id];
  return 'Sem categoria';
}

function getSellerName(item) {
  if (item.utilizador?.name) return item.utilizador.name;
  if (item.seller_id && sellerMap[item.seller_id]) return sellerMap[item.seller_id];
  return 'Vendedor desconhecido';
}

function getWearLabel(value) {
  return wearLabels[value] || value || 'Sem estado';
}

function getSellStatusLabel(value) {
  return sellStatusLabels[value] || value || 'Sem estado';
}

function createBadge(text) {
  return `<span class="badge">${text}</span>`;
}

function createStatusPill(status) {
  return `<span class="status-pill status-pill--${status}">${getSellStatusLabel(status)}</span>`;
}

function showMessage(target, type, message) {
  if (!target) return;
  target.className = `app-alert app-alert--${type}`;
  target.textContent = message;
  target.hidden = false;
}

async function getAdminProfile() {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!authData?.user) {
    window.location.replace('login.html?returnUrl=admin.html');
    throw new Error('Sessão inexistente.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('utilizador')
    .select('id, name, is_admin')
    .eq('id', authData.user.id)
    .single();

  if (profileError) throw profileError;
  if (!profile?.is_admin) {
    window.location.replace('dashboard.html');
    throw new Error('Acesso restrito.');
  }

  return profile;
}

function switchToTab(tabId) {
  document.querySelector('.admin-tab-bar')
    ?.querySelectorAll('.admin-tab')
    .forEach((t) => t.classList.toggle('admin-tab--active', t.dataset.tab === tabId));
  document.querySelectorAll('.admin-tab-pane').forEach((pane) => {
    pane.hidden = pane.id !== `tab-${tabId}`;
  });
}

function selectCategory(categoryId, categoryName) {
  selectedCategoryId = categoryId;

  if (activeCategoryFilter) activeCategoryFilter.hidden = false;
  if (activeCategoryName) activeCategoryName.textContent = categoryName;

  categoriesList?.querySelectorAll('.category-card').forEach((card) => {
    card.classList.toggle('category-card--active', card.dataset.categoryId === categoryId);
  });

  switchToTab('reviews');
  renderReviews();
}

function clearCategoryFilter() {
  selectedCategoryId = null;

  if (activeCategoryFilter) activeCategoryFilter.hidden = true;

  categoriesList?.querySelectorAll('.category-card').forEach((card) => {
    card.classList.remove('category-card--active');
  });

  renderReviews();
}

function setCategoryFormEditMode(category) {
  if (!categoryForm) return;
  categoryForm.dataset.editingId = category.id;
  if (categoryNameInput) categoryNameInput.value = category.name;
  if (categoryIconInput) categoryIconInput.value = category.icon_url || '';
  const submitBtn = categoryForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Guardar alterações';
  if (categoryFormTitle) categoryFormTitle.textContent = 'Editar categoria';
  if (cancelEditBtn) cancelEditBtn.hidden = false;
  categoryNameInput?.focus();
}

function resetCategoryForm() {
  if (!categoryForm) return;
  delete categoryForm.dataset.editingId;
  categoryForm.reset();
  const submitBtn = categoryForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Criar categoria';
  if (categoryFormTitle) categoryFormTitle.textContent = 'Criar categoria';
  if (cancelEditBtn) cancelEditBtn.hidden = true;
}

function renderCategories(categories) {
  if (!categoriesList) return;

  if (!categories.length) {
    categoriesList.innerHTML = '<div class="app-alert app-alert--neutral">Ainda não existem categorias.</div>';
    return;
  }

  categoriesList.innerHTML = categories.map((category) => {
    const isActive = category.id === selectedCategoryId;
    const itemCount = cachedItems.filter((item) => item.category_id === category.id).length;
    return `
      <article class="category-card${isActive ? ' category-card--active' : ''}"
        data-category-id="${category.id}"
        data-category-name-full="${category.name}">
        <strong>${category.name}</strong>
        <span>${itemCount} anúncio${itemCount !== 1 ? 's' : ''}${category.icon_url ? ' · ícone' : ''}</span>
        <div class="category-card__actions">
          <button class="app-btn app-btn--soft category-card__btn" type="button"
            data-category-edit="${category.id}"
            data-category-name="${category.name}"
            data-category-icon="${category.icon_url || ''}">Editar</button>
          <button class="app-btn app-btn--danger-soft category-card__btn" type="button"
            data-category-delete="${category.id}"
            data-category-name="${category.name}">Apagar</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderMetrics() {
  if (metricItems) metricItems.textContent = String(cachedItems.length);
  if (metricCategories) metricCategories.textContent = String(cachedCategories.length);
  if (metricAvailable) metricAvailable.textContent = String(cachedItems.filter((item) => item.sell_status === 'disponivel').length);
  if (metricClosed) {
    const closedCount = cachedItems.filter((item) => item.sell_status === 'reservado' || item.sell_status === 'vendido').length;
    metricClosed.textContent = String(closedCount);
  }
  if (metricUsers) metricUsers.textContent = String(cachedUsers.length);
}

function filterItems(items) {
  const searchTerm = (reviewSearch?.value || '').trim().toLowerCase();
  const selectedStatus = statusFilter?.value || 'all';

  return items.filter((item) => {
    const matchesSearch = !searchTerm
      || [item.title, getSellerName(item), getCategoryName(item)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchTerm));

    const matchesStatus = selectedStatus === 'all' || item.sell_status === selectedStatus;
    const matchesCategory = !selectedCategoryId || item.category_id === selectedCategoryId;

    return matchesSearch && matchesStatus && matchesCategory;
  });
}

function renderReviews() {
  if (!reviewsList) return;

  const items = filterItems(cachedItems);

  if (!items.length) {
    reviewsList.innerHTML = '<div class="app-alert app-alert--neutral app-alert--center">Nenhum anúncio corresponde aos filtros atuais.</div>';
    return;
  }

  reviewsList.innerHTML = items.map((item) => {
    const imageUrl = getPrimaryImage(item);
    const categoryName = getCategoryName(item);
    const sellerName = getSellerName(item);
    const wearLabel = getWearLabel(item.wear_status);

    return `
      <article class="admin-review-card" data-item-id="${item.id}">
        <div class="admin-review-card__media">
          <img src="${imageUrl}" alt="${item.title || 'Anúncio'}">
        </div>
        <div class="admin-review-card__body">
          <div class="admin-review-card__header">
            <div>
              <h3 class="admin-review-title">${item.title || 'Sem título'}</h3>
              <p class="admin-review-meta">${sellerName}${item.sellerUniversity ? ` · ${item.sellerUniversity}` : ''}</p>
            </div>
            ${createStatusPill(item.sell_status || 'disponivel')}
          </div>

          <p class="admin-review-copy">${item.description || 'Sem descrição disponível.'}</p>

          <div class="badge-list">
            ${createBadge(categoryName)}
            ${createBadge(wearLabel)}
            ${createBadge(formatPrice(item.price))}
          </div>

          <div class="admin-review-actions">
            <a class="app-btn app-btn--ghost" href="item.html?id=${item.id}">Abrir anúncio</a>
            <button class="app-btn app-btn--soft" type="button" data-status-action="disponivel" data-item-id="${item.id}">Disponível</button>
            <button class="app-btn app-btn--soft" type="button" data-status-action="reservado" data-item-id="${item.id}">Reservado</button>
            <button class="app-btn app-btn--soft" type="button" data-status-action="vendido" data-item-id="${item.id}">Vendido</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderUsers() {
  if (!usersList) return;

  if (!cachedUsers.length) {
    usersList.innerHTML = '<div class="app-alert app-alert--neutral app-alert--center">Nenhum utilizador encontrado.</div>';
    return;
  }

  usersList.innerHTML = cachedUsers.map((user) => `
    <article class="user-card">
      <div class="user-card__info">
        <strong class="user-card__name">${user.name || 'Sem nome'}</strong>
        <span class="user-card__meta">${user.university || 'Sem universidade'}</span>
        ${user.is_admin ? '<span class="badge">Admin</span>' : ''}
      </div>
      <div class="user-card__actions">
        <button class="app-btn ${user.is_admin ? 'app-btn--danger-soft' : 'app-btn--soft'}" type="button"
          data-user-toggle="${user.id}"
          data-user-admin="${user.is_admin}">
          ${user.is_admin ? 'Remover admin' : 'Tornar admin'}
        </button>
      </div>
    </article>
  `).join('');
}

async function loadCategories() {
  const { data, error } = await supabase
    .from('categoria')
    .select('id, name, icon_url, created_at')
    .order('name', { ascending: true });

  if (error) throw error;

  cachedCategories = data || [];
  categoryMap = cachedCategories.reduce((accumulator, category) => {
    accumulator[category.id] = category.name;
    return accumulator;
  }, {});

  renderCategories(cachedCategories);
}

async function loadItems() {
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

  if (error) throw error;

  cachedItems = data || [];

  const sellerIds = Array.from(new Set(cachedItems.map((item) => item.seller_id).filter(Boolean)));
  sellerMap = {};

  if (sellerIds.length) {
    const { data: sellers, error: sellersError } = await supabase
      .from('utilizador')
      .select('id, name, university')
      .in('id', sellerIds);

    if (!sellersError && sellers) {
      sellerMap = sellers.reduce((accumulator, seller) => {
        accumulator[seller.id] = seller.name;
        return accumulator;
      }, {});

      cachedItems = cachedItems.map((item) => {
        const seller = sellers.find((entry) => entry.id === item.seller_id);
        return seller ? { ...item, utilizador: seller, sellerUniversity: seller.university } : item;
      });
    }
  }

  renderMetrics();
  renderReviews();
  // re-render categories so item counts are up to date
  renderCategories(cachedCategories);
}

async function loadUsers() {
  const { data, error } = await supabase
    .from('utilizador')
    .select('id, name, is_admin, university')
    .order('name', { ascending: true });

  if (error) throw error;

  cachedUsers = data || [];
  if (usersStatus) usersStatus.hidden = true;
  renderUsers();
  renderMetrics();
}

async function refreshDashboard() {
  if (reviewStatus) {
    showMessage(reviewStatus, 'neutral', 'A carregar anúncios...');
  }
  if (usersStatus) {
    showMessage(usersStatus, 'neutral', 'A carregar utilizadores...');
  }

  try {
    await Promise.all([loadCategories(), loadItems(), loadUsers()]);
    if (reviewStatus) {
      showMessage(reviewStatus, 'success', `A mostrar ${cachedItems.length} anúncio${cachedItems.length === 1 ? '' : 's'} e ${cachedCategories.length} categoria${cachedCategories.length === 1 ? '' : 's'}.`);
    }
  } catch (error) {
    console.error('Erro ao carregar painel de admin:', error);
    if (reviewStatus) {
      showMessage(reviewStatus, 'danger', 'Não foi possível carregar o painel de administração.');
    }
    if (reviewsList) {
      reviewsList.innerHTML = '<div class="app-alert app-alert--danger app-alert--center">Erro ao carregar os anúncios.</div>';
    }
  }
}

async function createCategory(event) {
  event.preventDefault();

  const name = categoryNameInput?.value.trim();
  const iconUrl = categoryIconInput?.value.trim();
  const editingId = categoryForm?.dataset.editingId;

  if (!name) {
    showMessage(reviewStatus, 'danger', 'Indica o nome da categoria.');
    return;
  }

  const submitBtn = categoryForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = editingId ? 'A guardar...' : 'A criar...';
  }

  try {
    const payload = { name, icon_url: iconUrl || null };

    if (editingId) {
      const { error } = await supabase.from('categoria').update(payload).eq('id', editingId);
      if (error) throw error;
      resetCategoryForm();
      await refreshDashboard();
      showMessage(reviewStatus, 'success', 'Categoria atualizada com sucesso.');
    } else {
      const { error } = await supabase.from('categoria').insert(payload);
      if (error) throw error;
      categoryForm.reset();
      await refreshDashboard();
      showMessage(reviewStatus, 'success', 'Categoria criada com sucesso.');
    }
  } catch (error) {
    console.error('Erro ao guardar categoria:', error);
    showMessage(reviewStatus, 'danger', error.message || 'Não foi possível guardar a categoria.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = categoryForm?.dataset.editingId ? 'Guardar alterações' : 'Criar categoria';
    }
  }
}

async function updateItemStatus(itemId, sellStatus) {
  const { error } = await supabase
    .from('item')
    .update({ sell_status: sellStatus })
    .eq('id', itemId);

  if (error) throw error;
}

function bindListActions() {
  if (!reviewsList) return;

  reviewsList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-status-action]');
    if (!button) return;

    const itemId = button.dataset.itemId;
    const status = button.dataset.statusAction;

    if (!itemId || !status) return;

    button.disabled = true;

    try {
      await updateItemStatus(itemId, status);
      await loadItems();
      showMessage(reviewStatus, 'success', 'Estado do anúncio actualizado.');
    } catch (error) {
      console.error('Erro ao actualizar anúncio:', error);
      showMessage(reviewStatus, 'danger', error.message || 'Não foi possível actualizar o anúncio.');
    } finally {
      button.disabled = false;
    }
  });
}

function bindCategoryActions() {
  if (!categoriesList) return;

  categoriesList.addEventListener('click', async (event) => {
    // Edit button
    const editBtn = event.target.closest('[data-category-edit]');
    if (editBtn) {
      setCategoryFormEditMode({
        id: editBtn.dataset.categoryEdit,
        name: editBtn.dataset.categoryName,
        icon_url: editBtn.dataset.categoryIcon || ''
      });
      categoryForm?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    // Delete button
    const deleteBtn = event.target.closest('[data-category-delete]');
    if (deleteBtn) {
      const categoryId = deleteBtn.dataset.categoryDelete;
      const categoryName = deleteBtn.dataset.categoryName;

      if (!confirm(`Apagar a categoria "${categoryName}"? Esta ação não pode ser desfeita.`)) return;

      deleteBtn.disabled = true;

      try {
        const { error } = await supabase.from('categoria').delete().eq('id', categoryId);
        if (error) throw error;
        if (categoryForm?.dataset.editingId === categoryId) resetCategoryForm();
        if (selectedCategoryId === categoryId) clearCategoryFilter();
        await refreshDashboard();
        showMessage(reviewStatus, 'success', 'Categoria apagada com sucesso.');
      } catch (error) {
        console.error('Erro ao apagar categoria:', error);
        showMessage(reviewStatus, 'danger', error.message || 'Não foi possível apagar a categoria.');
        deleteBtn.disabled = false;
      }
      return;
    }

    // Card click — filter announcements by this category
    const card = event.target.closest('.category-card[data-category-id]');
    if (!card) return;

    const categoryId = card.dataset.categoryId;
    const categoryName = card.dataset.categoryNameFull;

    if (selectedCategoryId === categoryId) {
      clearCategoryFilter();
    } else {
      selectCategory(categoryId, categoryName);
    }
  });
}

function bindUserActions() {
  if (!usersList) return;

  usersList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-user-toggle]');
    if (!button) return;

    const userId = button.dataset.userToggle;
    const currentAdmin = button.dataset.userAdmin === 'true';

    button.disabled = true;

    try {
      const { error } = await supabase
        .from('utilizador')
        .update({ is_admin: !currentAdmin })
        .eq('id', userId);
      if (error) throw error;
      await loadUsers();
    } catch (error) {
      console.error('Erro ao atualizar permissões:', error);
      showMessage(reviewStatus, 'danger', error.message || 'Não foi possível alterar as permissões.');
      button.disabled = false;
    }
  });
}

function initTabs() {
  const tabBar = document.querySelector('.admin-tab-bar');
  if (!tabBar) return;

  tabBar.addEventListener('click', (event) => {
    const tab = event.target.closest('.admin-tab');
    if (!tab) return;

    const tabId = tab.dataset.tab;

    // Clicking the Anúncios tab clears the category filter
    if (tabId === 'reviews' && selectedCategoryId) {
      clearCategoryFilter();
    }

    switchToTab(tabId);
  });
}

async function init() {
  try {
    const profile = await getAdminProfile();
    if (adminStatus) {
      adminStatus.textContent = profile?.name ? `Bem-vindo, ${profile.name}.` : 'Bem-vindo ao painel de administração.';
    }

    bindListActions();
    bindCategoryActions();
    bindUserActions();
    initTabs();

    if (categoryForm) {
      categoryForm.addEventListener('submit', createCategory);
    }

    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', resetCategoryForm);
    }

    if (clearCategoryFilterBtn) {
      clearCategoryFilterBtn.addEventListener('click', clearCategoryFilter);
    }

    if (reviewSearch) {
      reviewSearch.addEventListener('input', renderReviews);
    }

    if (statusFilter) {
      statusFilter.addEventListener('change', renderReviews);
    }

    await refreshDashboard();
  } catch (error) {
    console.error('Erro a iniciar painel de admin:', error);
    if (adminStatus) {
      adminStatus.textContent = 'Acesso não autorizado ou sessão inválida.';
    }
  }
}

init();
