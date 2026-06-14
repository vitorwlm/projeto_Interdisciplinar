/*
 * publish.js — Página de criação de um novo anúncio.
 *
 * Fluxo do utilizador:
 *   1. Preenche título, descrição, categoria, estado e preço.
 *   2. (Opcional) Escolhe até 5 fotografias.
 *   3. Submete — o item é inserido na BD e as imagens são carregadas para
 *      o Supabase Storage.
 *   4. Após sucesso, é redirecionado para o dashboard.
 */

import { supabase } from '../config/supabaseClient.js';
import {
  initPage,
  getCurrentUser,
  uploadItemImages,
  initFilePicker,
  loadCategories,
  showAlert,
  setButtonLoading
} from '../utils/utils.js';

await initPage();

const publishForm = document.getElementById('publish-form');
const fileInput = document.querySelector('input[type="file"][name="item-images"]');
const fileNameEl = document.getElementById('file-name');
const imagePreviewEl = document.getElementById('image-preview');

/*
 * setSubmitting — Ativa/desativa o estado de carregamento do botão de submissão.
 * Extraída para função separada para ser chamada tanto no início como no "finally".
 */
function setSubmitting(isSubmitting) {
  const submitBtn = publishForm.querySelector('button[type="submit"]');
  setButtonLoading(submitBtn, isSubmitting, 'A publicar...', 'Publicar Anúncio');
}

/*
 * initFilePicker liga o <input type="file"> à pré-visualização de imagens.
 * É chamado aqui (antes do submit) para que o utilizador possa ver as
 * fotografias selecionadas antes de publicar.
 */
initFilePicker(fileInput, fileNameEl, imagePreviewEl);

if (publishForm) {
  publishForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const title = document.getElementById('item-title').value.trim();
    const description = document.getElementById('item-description').value.trim();
    const category = document.getElementById('item-category').value;
    const condition = document.getElementById('item-condition').value;
    const priceValue = document.getElementById('item-price').value;

    /*
     * .slice(0, 5) no Array.from garante que nunca se tentam enviar
     * mais de 5 imagens mesmo que o limite do input HTML seja contornado.
     */
    const files = Array.from(fileInput.files || []).slice(0, 5);

    /*
     * Validação do lado do cliente — dá feedback imediato sem precisar
     * de fazer um pedido à rede. A BD tem também as suas próprias
     * restrições (NOT NULL, etc.) como segunda linha de defesa.
     */
    if (!title || !description || !category || !condition || !priceValue) {
      showAlert(publishForm, 'danger', 'Preenche todos os campos obrigatórios.');
      return;
    }

    /*
     * O preço tem de ser um número maior que 0. Sem isto era possível publicar
     * com preço negativo ou inválido.
     */
    if (Number.isNaN(Number(priceValue)) || Number(priceValue) <= 0) {
      showAlert(publishForm, 'danger', 'Indica um preço válido (maior que 0).');
      return;
    }

    setSubmitting(true);

    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) throw new Error('Sessão expirada. Faz login novamente.');

      /*
       * Construir o objeto do anúncio e inserir na tabela "item".
       * "sell_status: 'disponivel'" é o estado inicial — o anúncio fica
       * imediatamente visível e comprável no dashboard.
       * O .select('id').single() devolve o ID gerado pela BD, necessário
       * para associar as imagens ao anúncio.
       */
      const itemData = {
        seller_id: currentUser.id,
        title: title,
        description: description,
        price: Number(priceValue),
        wear_status: condition,
        sell_status: 'disponivel'
      };
      if (category) itemData.category_id = category;

      const { data, error } = await supabase
        .from('item')
        .insert(itemData)
        .select('id')
        .single();

      if (error) throw error;
      const itemId = data.id;

      /*
       * O upload das imagens acontece APÓS a inserção do item na BD,
       * porque precisa do itemId para construir o caminho no Storage.
       * Se o upload falhar, o item já existe mas sem imagens — aceitável,
       * o utilizador pode editar e adicionar fotos depois.
       */
      await uploadItemImages(itemId, currentUser.id, files);

      showAlert(publishForm, 'success', 'Artigo publicado com sucesso.');
      publishForm.reset();
      if (fileNameEl) fileNameEl.textContent = 'Nenhuma fotografia seleccionada';
      if (imagePreviewEl) imagePreviewEl.innerHTML = '';

      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
    } catch (err) {
      console.error('Erro ao publicar artigo:', err);
      showAlert(publishForm, 'danger', err.message || 'Não foi possível publicar o artigo.');
    } finally {
      setSubmitting(false);
    }
  });
}

/*
 * Carregar as categorias no select assim que a página carrega,
 * para que o utilizador não precise de esperar pelo submit para
 * ver as opções disponíveis.
 */
loadCategories();
