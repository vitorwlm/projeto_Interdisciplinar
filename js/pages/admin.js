/*
 * admin.js — Painel de administração da aplicação.
 *
 * Acesso restrito: apenas utilizadores com "is_admin = true" na tabela
 * "utilizador" podem aceder. Qualquer outro utilizador é redirecionado
 * para o dashboard — a verificação é feita no servidor (BD), não apenas
 * no cliente.
 *
 * Funcionalidades:
 *   • Métricas globais: total de anúncios, categorias e utilizadores.
 *   • Gestão de categorias: criar, editar e apagar.
 *   • Gestão de utilizadores: promover ou revogar privilégios de admin.
 *
 * Estratégia de dados:
 *   Os dados são carregados uma vez para variáveis "cached*" e reutilizados
 *   nos vários renders — evita queries repetidas para operações que só
 *   precisam de dados já carregados (ex.: contar anúncios por categoria).
 */

import { supabase } from '../config/supabaseClient.js';
import { initPage, getCurrentUser, plural, showAlert, renderNotice } from '../utils/utils.js';

await initPage();


/* ── Elementos da página ────────────────────────────────────────────────── */

const adminStatus = document.getElementById('admin-status');
const metricItems = document.getElementById('metric-items');
const metricCategories = document.getElementById('metric-categories');
const metricUsers = document.getElementById('metric-users');

const categoryForm = document.getElementById('category-form');
const categoryNameInput = document.getElementById('category-name');
const categoryIconInput = document.getElementById('category-icon');
const categoryFormTitle = document.getElementById('category-form-title');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const categoriesList = document.getElementById('categories-list');

const usersList = document.getElementById('users-list');
const usersStatus = document.getElementById('users-status');

/*
 * Variáveis de cache dos dados carregados da BD.
 * Guardar em variáveis de módulo permite que os renders acedam aos dados
 * sem repetir queries e que as métricas sejam calculadas localmente.
 */
let cachedItems = [];
let cachedCategories = [];
let cachedUsers = [];


/* ── Acesso ─────────────────────────────────────────────────────────────── */

/*
 * getAdminProfile — Verifica se o utilizador autenticado é administrador.
 *
 * Porquê verificar na BD em vez de usar um token ou variável local?
 *   O campo "is_admin" é o único dado fiável — está na BD e é controlado
 *   pelo servidor. Uma variável local poderia ser manipulada pelo utilizador
 *   nas ferramentas de desenvolvimento do browser.
 *
 * Se não for admin, redireciona imediatamente para o dashboard sem revelar
 * nenhum conteúdo da página de admin.
 */
async function getAdminProfile() {
  const user = await getCurrentUser();

  if (!user) {
    window.location.replace('login.html?returnUrl=admin.html');
    throw new Error('Sessão inexistente.');
  }

  const { data: profile, error } = await supabase
    .from('utilizador')
    .select('id, name, is_admin')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  if (!profile || !profile.is_admin) {
    window.location.replace('dashboard.html');
    throw new Error('Acesso restrito.');
  }

  return profile;
}


/* ── Métricas ────────────────────────────────────────────────────────────── */

/*
 * renderMetrics — Atualiza os contadores de anúncios, categorias e utilizadores.
 *
 * Usa os arrays em cache (já carregados) em vez de fazer novas queries,
 * por isso é síncrona e muito rápida. É chamada sempre que os dados mudam.
 */
function renderMetrics() {
  if (metricItems) metricItems.textContent = String(cachedItems.length);
  if (metricCategories) metricCategories.textContent = String(cachedCategories.length);
  if (metricUsers) metricUsers.textContent = String(cachedUsers.length);
}


/* ── Categorias ─────────────────────────────────────────────────────────── */

/*
 * renderCategories — Desenha a lista de categorias com botões de editar/apagar.
 *
 * Porquê calcular "itemCount" com filter local em vez de uma query?
 *   cachedItems já contém todos os anúncios (com category_id). Filtrar
 *   localmente é instantâneo e evita N queries adicionais (uma por categoria).
 */
function renderCategories() {
  if (!categoriesList) return;

  if (!cachedCategories.length) {
    renderNotice(categoriesList, 'Ainda não existem categorias.', 'neutral', false);
    return;
  }

  categoriesList.innerHTML = cachedCategories.map((category) => {
    const itemCount = cachedItems.filter((item) => item.category_id === category.id).length;
    const extra = category.icon_url ? ' · ícone' : '';
    return `
      <article class="category-card" data-category-id="${category.id}">
        <strong>${category.name}</strong>
        <span>${plural(itemCount, 'anúncio')}${extra}</span>
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

  const editBtns = categoriesList.querySelectorAll('[data-category-edit]');
  editBtns.forEach((btn) => btn.addEventListener('click', () => editarCategoria(btn)));

  const deleteBtns = categoriesList.querySelectorAll('[data-category-delete]');
  deleteBtns.forEach((btn) => btn.addEventListener('click', () => apagarCategoria(btn)));
}

/*
 * editarCategoria — Preenche o formulário com os dados da categoria a editar
 * e faz scroll até ele.
 *
 * O ID da categoria em edição é guardado em "categoryForm.dataset.editingId"
 * para que o submit do formulário saiba se deve fazer INSERT ou UPDATE.
 */
function editarCategoria(btn) {
  setCategoryFormEditMode({
    id: btn.dataset.categoryEdit,
    name: btn.dataset.categoryName,
    icon_url: btn.dataset.categoryIcon || ''
  });
  if (categoryForm) categoryForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/*
 * apagarCategoria — Apaga uma categoria após confirmação.
 *
 * Porquê não apagar também os anúncios da categoria?
 *   Mantemos os anúncios (com category_id = null ou a referência quebrada)
 *   para não perder dados de utilizadores. A decisão de o que fazer com
 *   anúncios órfãos pode ser tratada futuramente com uma FK ON DELETE.
 */
async function apagarCategoria(btn) {
  const categoryId = btn.dataset.categoryDelete;
  const categoryName = btn.dataset.categoryName;

  if (!confirm('Apagar a categoria "' + categoryName + '"? Esta ação não pode ser desfeita.')) return;

  btn.disabled = true;

  try {
    const { error } = await supabase.from('categoria').delete().eq('id', categoryId);
    if (error) throw error;

    /*
     * Se estava a editar esta categoria, limpar o formulário para não tentar
     * fazer UPDATE de uma categoria que já não existe.
     */
    if (categoryForm.dataset.editingId === categoryId) resetCategoryForm();
    await refreshDashboard();
    showAlert(categoryForm, 'success', 'Categoria apagada com sucesso.');
  } catch (error) {
    console.error('Erro ao apagar categoria:', error);
    showAlert(categoryForm, 'danger', error.message || 'Não foi possível apagar a categoria.');
    btn.disabled = false;
  }
}

/*
 * setCategoryFormEditMode — Prepara o formulário para edição de uma categoria.
 * Guarda o ID no dataset do formulário para que o submit saiba fazer UPDATE.
 */
function setCategoryFormEditMode(category) {
  if (!categoryForm) return;
  categoryForm.dataset.editingId = category.id;
  if (categoryNameInput) categoryNameInput.value = category.name;
  if (categoryIconInput) categoryIconInput.value = category.icon_url || '';
  if (categoryFormTitle) categoryFormTitle.textContent = 'Editar categoria';
  if (cancelEditBtn) cancelEditBtn.hidden = false;
  const submitBtn = categoryForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Guardar alterações';
  if (categoryNameInput) categoryNameInput.focus();
}

/*
 * resetCategoryForm — Repõe o formulário para o modo de criação.
 * Remove o "editingId" do dataset para que o próximo submit faça INSERT.
 */
function resetCategoryForm() {
  if (!categoryForm) return;
  delete categoryForm.dataset.editingId;
  categoryForm.reset();
  if (categoryFormTitle) categoryFormTitle.textContent = 'Criar categoria';
  if (cancelEditBtn) cancelEditBtn.hidden = true;
  const submitBtn = categoryForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Criar categoria';
}

/*
 * createCategory — Handler do submit do formulário de categoria.
 *
 * Dupla função (INSERT ou UPDATE) decidida pelo "editingId" no dataset —
 * um único formulário para os dois casos, menos HTML e menos código.
 *
 * Após qualquer operação bem sucedida, refreshDashboard() recarrega todos
 * os dados para garantir que as métricas e a lista ficam atualizadas.
 */
async function createCategory(event) {
  event.preventDefault();

  const name = categoryNameInput.value.trim();
  const iconUrl = categoryIconInput.value.trim();
  const editingId = categoryForm.dataset.editingId;

  if (!name) {
    showAlert(categoryForm, 'danger', 'Indica o nome da categoria.');
    return;
  }

  const submitBtn = categoryForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = editingId ? 'A guardar...' : 'A criar...';
  }

  try {
    const payload = { name: name, icon_url: iconUrl || null };

    if (editingId) {
      const { error } = await supabase.from('categoria').update(payload).eq('id', editingId);
      if (error) throw error;
      resetCategoryForm();
      await refreshDashboard();
      showAlert(categoryForm, 'success', 'Categoria atualizada com sucesso.');
    } else {
      const { error } = await supabase.from('categoria').insert(payload);
      if (error) throw error;
      categoryForm.reset();
      await refreshDashboard();
      showAlert(categoryForm, 'success', 'Categoria criada com sucesso.');
    }
  } catch (error) {
    console.error('Erro ao guardar categoria:', error);
    showAlert(categoryForm, 'danger', error.message || 'Não foi possível guardar a categoria.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = categoryForm.dataset.editingId ? 'Guardar alterações' : 'Criar categoria';
    }
  }
}


/* ── Utilizadores ───────────────────────────────────────────────────────── */

/*
 * renderUsers — Desenha a lista de utilizadores com a opção de gerir admin.
 *
 * O estado do botão (texto e cor) muda consoante o utilizador já seja admin
 * ou não — feedback visual imediato sobre o estado atual.
 */
function renderUsers() {
  if (!usersList) return;

  if (!cachedUsers.length) {
    renderNotice(usersList, 'Nenhum utilizador encontrado.', 'neutral', true);
    return;
  }

  usersList.innerHTML = cachedUsers.map((user) => {
    const adminBadge = user.is_admin ? '<span class="badge">Admin</span>' : '';
    const btnClass = user.is_admin ? 'app-btn--danger-soft' : 'app-btn--soft';
    const btnText = user.is_admin ? 'Remover admin' : 'Tornar admin';
    return `
    <article class="user-card">
      <div class="user-card__info">
        <strong class="user-card__name">${user.name || 'Sem nome'}</strong>
        <span class="user-card__meta">${user.university || 'Sem universidade'}</span>
        ${adminBadge}
      </div>
      <div class="user-card__actions">
        <button class="app-btn ${btnClass}" type="button"
          data-user-toggle="${user.id}"
          data-user-admin="${user.is_admin}">
          ${btnText}
        </button>
      </div>
    </article>
  `;
  }).join('');

  const botoes = usersList.querySelectorAll('[data-user-toggle]');
  botoes.forEach((btn) => btn.addEventListener('click', () => toggleAdmin(btn)));
}

/*
 * toggleAdmin — Inverte o estado "is_admin" de um utilizador.
 *
 * "btn.dataset.userAdmin === 'true'" — os atributos data-* são sempre
 * strings no HTML, por isso a comparação tem de ser com a string 'true'
 * e não com o booleano true.
 *
 * Após a operação, recarregamos loadUsers() (não refreshDashboard())
 * porque só a lista de utilizadores precisa de ser atualizada.
 */
async function toggleAdmin(btn) {
  const userId = btn.dataset.userToggle;
  const currentAdmin = btn.dataset.userAdmin === 'true';

  btn.disabled = true;

  try {
    const { error } = await supabase
      .from('utilizador')
      .update({ is_admin: !currentAdmin })
      .eq('id', userId);
    if (error) throw error;
    await loadUsers();
  } catch (error) {
    console.error('Erro ao atualizar permissões:', error);
    btn.disabled = false;
  }
}


/* ── Carregamento de dados ──────────────────────────────────────────────── */

async function loadCategories() {
  const { data, error } = await supabase
    .from('categoria')
    .select('id, name, icon_url')
    .order('name', { ascending: true });

  if (error) throw error;

  cachedCategories = data || [];
  renderCategories();
}

/*
 * loadItems — Carrega apenas os campos necessários para o painel admin.
 *
 * Porquê só "id" e "category_id"?
 *   O admin só precisa de contar os anúncios por categoria e no total.
 *   Evitar carregar título, descrição, imagens, etc. reduz significativamente
 *   os dados transferidos.
 */
async function loadItems() {
  const { data, error } = await supabase.from('item').select('id, category_id');

  if (error) throw error;

  cachedItems = data || [];
  renderMetrics();
  renderCategories();
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

/*
 * refreshDashboard — Recarrega todos os dados em paralelo com Promise.all.
 *
 * Porquê Promise.all em vez de await sequencial?
 *   As três queries são independentes entre si — correm ao mesmo tempo
 *   e terminam quando a mais lenta acabar, em vez de esperar pela primeira,
 *   depois pela segunda, depois pela terceira.
 */
async function refreshDashboard() {
  try {
    await Promise.all([loadCategories(), loadItems(), loadUsers()]);
  } catch (error) {
    console.error('Erro ao carregar painel de admin:', error);
    showAlert(categoryForm, 'danger', 'Não foi possível carregar o painel de administração.');
  }
}


/* ── Arranque ────────────────────────────────────────────────────────────── */

/*
 * init — Ponto de entrada do painel de admin.
 *
 * Porquê encapsular tudo numa função "init" em vez de código solto?
 *   Permite usar try/catch para apanhar erros de getAdminProfile()
 *   (que pode lançar exceções e redirecionar) sem que o erro quebre
 *   silenciosamente o resto da inicialização.
 */
async function init() {
  try {
    const profile = await getAdminProfile();
    if (adminStatus) {
      adminStatus.textContent = (profile && profile.name)
        ? 'Bem-vindo, ' + profile.name + '.'
        : 'Bem-vindo ao painel de administração.';
    }

    if (categoryForm) categoryForm.addEventListener('submit', createCategory);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetCategoryForm);

    await refreshDashboard();
  } catch (error) {
    console.error('Erro a iniciar painel de admin:', error);
    if (adminStatus) adminStatus.textContent = 'Acesso não autorizado ou sessão inválida.';
  }
}

init();
