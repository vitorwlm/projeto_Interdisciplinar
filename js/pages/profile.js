/*
 * profile.js — Página de perfil do utilizador autenticado.
 *
 * Secções da página:
 *   1. Informação pessoal (avatar com iniciais, nome, email, universidade).
 *   2. Formulário de edição do perfil (nome e universidade).
 *   3. Estatísticas (total de anúncios publicados e favoritos guardados).
 *   4. Grelha dos anúncios publicados pelo utilizador.
 *
 * Porquê duas tabelas para os dados do utilizador?
 *   O Supabase Auth gere a autenticação na tabela "auth.users" (gerida
 *   internamente). A nossa tabela "utilizador" guarda dados extra do perfil
 *   (nome, universidade, is_admin). Esta separação segue a arquitetura
 *   recomendada pelo Supabase.
 */

import { supabase } from '../config/supabaseClient.js';
import { initPage, getCurrentUser, renderItemCard, showAlert, setButtonLoading } from '../utils/utils.js';

await initPage();

let currentUserId = null;


/* ── Elementos da página ────────────────────────────────────────────────── */

const avatarEl        = document.getElementById('profile-avatar');
const nameEl          = document.getElementById('profile-name');
const emailEl         = document.getElementById('profile-email');
const universityEl    = document.getElementById('profile-university');
const statItemsEl     = document.getElementById('stat-items');
const statFavsEl      = document.getElementById('stat-favs');
const nameInput       = document.getElementById('profile-name-input');
const universityInput = document.getElementById('profile-university-input');
const profileForm     = document.getElementById('profile-form');
const saveBtn         = document.getElementById('save-profile-btn');
const myItemsGrid     = document.getElementById('my-items-grid');
const myItemsStatus   = document.getElementById('my-items-status');


/* ── Avatar com iniciais ────────────────────────────────────────────────── */

/*
 * getInitials — Extrai as iniciais do nome para usar no avatar.
 *
 * Lógica:
 *   • Nome com uma palavra → primeira letra.
 *   • Nome com várias palavras → primeira letra do primeiro e do último nome.
 *
 * Porquê usar iniciais em vez de uma fotografia de perfil?
 *   Simplifica a implementação (não precisa de upload de avatar) e é
 *   uma solução visual limpa e amplamente usada (ex.: Google, Slack).
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}


/* ── Carregar dados do perfil ───────────────────────────────────────────── */

/*
 * loadProfile — Carrega e exibe os dados do utilizador.
 *
 * Porquê duas fontes (auth.getUser + tabela utilizador)?
 *   getUser() devolve o email e o ID (da autenticação Supabase).
 *   A tabela "utilizador" guarda nome e universidade (dados extra do perfil).
 *   Combinamos as duas para preencher toda a UI.
 *
 * Define "currentUserId" para que as funções seguintes (loadStats, loadMyItems)
 * saibam qual utilizador consultar.
 */
async function loadProfile() {
  const user = await getCurrentUser();
  if (!user) return;

  currentUserId = user.id;

  const { data: profile } = await supabase
    .from('utilizador')
    .select('name, university')
    .eq('id', user.id)
    .single();

  const name       = (profile && profile.name)       || '';
  const university = (profile && profile.university) || '';
  const email      = user.email                      || '';

  if (avatarEl)     avatarEl.textContent       = getInitials(name);
  if (nameEl)       nameEl.textContent          = name       || 'Sem nome';
  if (emailEl)      emailEl.textContent         = email;
  if (universityEl) universityEl.textContent    = university || '';

  if (nameInput)       nameInput.value       = name;
  if (universityInput) universityInput.value = university;
}


/* ── Guardar alterações de perfil ───────────────────────────────────────── */

if (profileForm) profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const newName       = nameInput ? nameInput.value.trim() : '';
  const newUniversity = universityInput ? universityInput.value.trim() : '';

  setButtonLoading(saveBtn, true, 'A guardar...', 'Guardar alterações');

  const { error } = await supabase
    .from('utilizador')
    .update({ name: newName, university: newUniversity })
    .eq('id', currentUserId);

  setButtonLoading(saveBtn, false, 'A guardar...', 'Guardar alterações');

  if (error) {
    showAlert(profileForm, 'danger', 'Erro ao guardar. Tenta novamente.');
    return;
  }

  /*
   * Atualização imediata do nome e avatar na UI sem recarregar a página —
   * a página fica atualizada sem perder o scroll ou o estado de outros
   * elementos visuais. É a abordagem "optimistic update".
   */
  if (nameEl)   nameEl.textContent   = newName       || 'Sem nome';
  if (avatarEl) avatarEl.textContent = getInitials(newName);
  if (universityEl) universityEl.textContent = newUniversity;

  showAlert(profileForm, 'success', 'Perfil atualizado com sucesso!');
});


/* ── Estatísticas ───────────────────────────────────────────────────────── */

/*
 * loadStats — Conta os anúncios e favoritos do utilizador.
 *
 * Porquê usar "{ count: 'exact', head: true }"?
 *   Esta opção diz ao Supabase para devolver apenas o total (count) sem
 *   transferir as linhas. É mais eficiente do que buscar todos os registos
 *   e contar localmente — especialmente quando o utilizador tem muitos itens.
 */
async function loadStats() {
  if (!currentUserId) return;

  const { count: itemCount } = await supabase
    .from('item')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', currentUserId);

  const { count: favCount } = await supabase
    .from('favorito')
    .select('item_id', { count: 'exact', head: true })
    .eq('user_id', currentUserId);

  if (statItemsEl) statItemsEl.textContent = itemCount || 0;
  if (statFavsEl)  statFavsEl.textContent  = favCount  || 0;
}


/* ── Os meus anúncios ───────────────────────────────────────────────────── */

/*
 * loadMyItems — Carrega e exibe os anúncios publicados pelo utilizador.
 *
 * "showFav: false" em renderItemCard porque não faz sentido favoritar
 * os próprios anúncios — o botão de coração seria confuso neste contexto.
 */
async function loadMyItems() {
  if (!currentUserId) return;
  if (myItemsStatus) myItemsStatus.textContent = 'A carregar os teus anúncios...';

  const { data, error } = await supabase
    .from('item')
    .select(`
      id,
      title,
      description,
      price,
      wear_status,
      created_at,
      item_image ( image_url, is_principal )
    `)
    .eq('seller_id', currentUserId)
    .order('created_at', { ascending: false });

  if (error) {
    if (myItemsStatus) myItemsStatus.textContent = 'Erro ao carregar anúncios.';
    return;
  }

  if (!data || data.length === 0) {
    if (myItemsStatus) {
      myItemsStatus.textContent = 'Ainda não publicaste nenhum anúncio.';
    }
    return;
  }

  if (myItemsStatus) myItemsStatus.hidden = true;

  myItemsGrid.innerHTML = data.map((item) => renderItemCard(item, { showFav: false })).join('');
}


/* ── Iniciar página ─────────────────────────────────────────────────────── */

/*
 * loadProfile tem de correr primeiro e com "await" porque define
 * "currentUserId" — as funções seguintes dependem deste valor.
 *
 * loadStats e loadMyItems podem correr em paralelo (sem "await" individual)
 * porque são independentes entre si — poupar tempo de carregamento.
 */
await loadProfile();

loadStats();
loadMyItems();
