/*
 * edit.js — Página de edição de um anúncio existente.
 *
 * O ID do anúncio é passado via query string: edit.html?id=<uuid>
 *
 * Proteções implementadas:
 *   1. Sem ID na URL → redireciona para dashboard.
 *   2. Sem sessão → redireciona para login.
 *   3. Anúncio não encontrado → redireciona para dashboard.
 *   4. Utilizador não é o dono → redireciona para dashboard.
 *      (A query na BD inclui seller_id na condição para que o Supabase
 *       recuse o update mesmo que esta verificação seja contornada no cliente.)
 *
 * Funcionalidades:
 *   • Pré-preenche os campos com os dados atuais do anúncio.
 *   • Permite atualizar texto e categoria.
 *   • Permite substituir as fotografias (apaga as antigas antes de enviar as novas).
 *   • Permite apagar o anúncio por completo.
 */

import { supabase } from '../config/supabaseClient.js';
import {
  initPage,
  getCurrentUser,
  uploadItemImages,
  deleteItemImages,
  initFilePicker,
  renderImageGrid,
  loadCategories,
  showAlert,
  setButtonLoading
} from '../utils/utils.js';

await initPage();

const editForm = document.getElementById('edit-form');
const fileInput = document.querySelector('input[type="file"][name="listing-images"]');
const fileNameEl = document.getElementById('file-name');
const imagePreviewEl = document.getElementById('image-preview');
const currentImagesEl = document.getElementById('current-images');
const deleteBtn = document.getElementById('delete-listing-btn');

/*
 * currentItem e currentUser são variáveis de módulo partilhadas entre
 * loadItem(), o handler do formulário e o handler de apagar — evita
 * repetir as queries de autenticação em cada operação.
 */
let currentItem = null;
let currentUser = null;

function showNotification(type, message) {
  showAlert(editForm, type, message);
}

function setSubmitting(isSubmitting) {
  const submitBtn = document.getElementById('submit-edit-btn');
  setButtonLoading(submitBtn, isSubmitting, 'A guardar...', 'Guardar alterações');
}

/*
 * loadItem — Carrega o anúncio a editar e preenche o formulário.
 *
 * A verificação "data.seller_id !== currentUser.id" garante que um utilizador
 * não consegue editar anúncios alheios mesmo que conheça o ID do item,
 * complementando a proteção na query de UPDATE (que também filtra seller_id).
 */
async function loadItem() {
  const params = new URLSearchParams(window.location.search);
  const itemId = params.get('id');

  if (!itemId) {
    window.location.href = 'dashboard.html';
    return;
  }

  currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.href = 'login.html?returnUrl=edit.html%3Fid%3D' + itemId;
    return;
  }

  const { data, error } = await supabase
    .from('item')
    .select('id, title, description, price, wear_status, category_id, seller_id, item_image(image_url, is_principal)')
    .eq('id', itemId)
    .single();

  if (error || !data) {
    window.location.href = 'dashboard.html';
    return;
  }

  if (data.seller_id !== currentUser.id) {
    window.location.href = 'dashboard.html';
    return;
  }

  currentItem = data;

  /*
   * Os botões "Voltar" e "Cancelar" apontam para o detalhe do item
   * (em vez do dashboard), para que o utilizador possa cancelar a edição
   * e ver o anúncio no estado original.
   */
  const backBtn = document.getElementById('back-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  if (backBtn) backBtn.setAttribute('href', 'item.html?id=' + itemId);
  if (cancelBtn) cancelBtn.setAttribute('href', 'item.html?id=' + itemId);

  const titleEl = document.getElementById('listing-title');
  const descriptionEl = document.getElementById('listing-description');
  const priceEl = document.getElementById('listing-price');
  const conditionEl = document.getElementById('listing-condition');

  if (titleEl) titleEl.value = data.title || '';
  if (descriptionEl) descriptionEl.value = data.description || '';
  if (priceEl) priceEl.value = (data.price === null || data.price === undefined) ? '' : data.price;
  if (conditionEl) conditionEl.value = data.wear_status || '';

  /*
   * loadCategories recebe o ID da categoria atual para pré-selecionar a opção
   * correta no <select>, evitando que o utilizador tenha de escolher a mesma
   * categoria de novo ao guardar.
   */
  await loadCategories(data.category_id);

  renderImageGrid(currentImagesEl, data.item_image || [], 'preview-tile', 'Fotografia actual', 'Sem fotografias actuais.');
}

initFilePicker(fileInput, fileNameEl, imagePreviewEl);

if (editForm) {
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('listing-title').value.trim();
    const description = document.getElementById('listing-description').value.trim();
    const categoryId = document.getElementById('listing-category').value;
    const condition = document.getElementById('listing-condition').value;
    const price = document.getElementById('listing-price').value;
    const files = Array.from(fileInput.files || []).slice(0, 5);

    if (!title || !description || !categoryId || !condition || !price) {
      showNotification('danger', 'Preenche todos os campos obrigatórios.');
      return;
    }

    /* O preço tem de ser um número maior que 0. */
    if (Number.isNaN(Number(price)) || Number(price) <= 0) {
      showNotification('danger', 'Indica um preço válido (maior que 0).');
      return;
    }

    setSubmitting(true);

    try {
      /*
       * A condição ".eq('seller_id', currentUser.id)" no UPDATE é uma segunda
       * camada de segurança: mesmo que o currentItem.id seja manipulado no
       * browser, o Supabase recusa a operação se o seller_id não corresponder
       * ao utilizador autenticado (combinado com as RLS policies).
       */
      const { error: updateError } = await supabase
        .from('item')
        .update({
          title: title,
          description: description,
          price: Number(price),
          wear_status: condition,
          category_id: categoryId
        })
        .eq('id', currentItem.id)
        .eq('seller_id', currentUser.id);

      if (updateError) throw updateError;

      /*
       * Substituição de imagens:
       *   Apenas se o utilizador selecionou novos ficheiros.
       *   A estratégia é "apaga tudo e recarrega" em vez de um diff,
       *   o que é mais simples e garante consistência (não ficam fotos velhas).
       */
      if (files.length > 0) {
        await deleteItemImages(currentItem.id);
        await uploadItemImages(currentItem.id, currentUser.id, files);
      }

      showNotification('success', 'Anúncio atualizado com sucesso.');
      setTimeout(() => { window.location.href = 'item.html?id=' + currentItem.id; }, 1200);
    } catch (err) {
      console.error('Erro ao atualizar anúncio:', err);
      showNotification('danger', err.message || 'Não foi possível atualizar o anúncio.');
    } finally {
      setSubmitting(false);
    }
  });
}

/*
 * Botão de apagar — disponível na página de edição para poupar o utilizador
 * de ter de ir ao detalhe do item para apagar.
 */
if (deleteBtn) {
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Tens a certeza que queres apagar este anúncio? Esta ação não pode ser desfeita.')) return;

    deleteBtn.disabled = true;
    deleteBtn.textContent = 'A apagar...';

    try {
      await deleteItemImages(currentItem.id);

      /*
       * A condição seller_id garante que só o dono pode apagar —
       * proteção dupla (cliente + servidor).
       */
      const { error } = await supabase
        .from('item')
        .delete()
        .eq('id', currentItem.id)
        .eq('seller_id', currentUser.id);

      if (error) throw error;
      window.location.href = 'dashboard.html';
    } catch (err) {
      console.error('Erro ao apagar anúncio:', err);
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Apagar anúncio';
      showNotification('danger', err.message || 'Não foi possível apagar o anúncio.');
    }
  });
}

loadItem();
