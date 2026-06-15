/*
 * utils.js — Biblioteca de funções partilhadas por toda a aplicação.
 *
 * Porquê centralizar aqui?
 *   Em vez de repetir a mesma lógica (ex.: formatar preços, fazer upload de
 *   imagens, desenhar cartões) em cada página, criámos funções reutilizáveis
 *   que são importadas onde necessário. Isto segue o princípio DRY
 *   (Don't Repeat Yourself) e facilita a manutenção: corrigir um bug aqui
 *   corrige-o em toda a app de uma vez.
 *
 * Organização por secções:
 *   1. Arranque de página
 *   2. Sessão / utilizador
 *   3. Texto / listas
 *   4. Favoritos
 *   5. Conversas / chat
 *   6. Compra
 *   7. Formatação / labels
 *   8. Imagens
 *   9. Helpers de interface (UI)
 *  10. Base de dados (categorias)
 */

import { supabase } from '../config/supabaseClient.js';
import { registerServiceWorker } from '../sw-register.js';
import { runAuthGuard } from '../auth/auth-guard.js';


/* ══════════════════════════════════════════════════════════════════════════════
 * 1. ARRANQUE DE PÁGINA
 * ══════════════════════════════════════════════════════════════════════════════ */

/*
 * initLogout — Liga todos os botões de logout presentes na página.
 *
 * Porquê usar "scope: 'local'"?
 *   Termina a sessão apenas neste browser/aba, sem invalidar sessões ativas
 *   noutros dispositivos do mesmo utilizador. É o comportamento expectável
 *   num "sair" normal (não um "sair de todos os dispositivos").
 *
 * Porquê usar window.location.href em vez de replace()?
 *   No logout queremos que o utilizador possa usar o botão "Recuar" para
 *   voltar (ao contrário do login, onde não faz sentido).
 */
function initLogout() {
  const botoes = document.querySelectorAll('[data-logout-btn], #logout-btn');
  botoes.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) throw error;
        window.location.href = '../index.html';
      } catch (err) {
        console.error('Não foi possível terminar a sessão:', err.message);
      }
    });
  });
}

/*
 * initPage — Ponto de entrada comum a todas as páginas protegidas.
 *
 * Ordem de execução deliberada:
 *   1. registerServiceWorker → regista o SW o mais cedo possível.
 *   2. runAuthGuard → verifica a sessão; se redirecionar, para aqui.
 *   3. initLogout → só é necessário se a página carregar de facto.
 *
 * É exportada e chamada com "await" no topo de cada ficheiro de página,
 * o que garante que nenhuma lógica de página corre antes de a sessão
 * ser validada.
 */
export async function initPage() {
  registerServiceWorker();
  await runAuthGuard();
  initLogout();
}


/* ══════════════════════════════════════════════════════════════════════════════
 * 2. SESSÃO / UTILIZADOR
 * ══════════════════════════════════════════════════════════════════════════════ */

/*
 * getCurrentUser — Devolve o objeto do utilizador autenticado ou null.
 *
 * Porquê não usar getSession().user?
 *   getUser() valida o JWT junto do servidor Supabase, garantindo que o
 *   token ainda é válido e não foi revogado. getSession() usa apenas o
 *   token local, que pode estar desatualizado.
 */
export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  if (data && data.user) return data.user;
  return null;
}


/* ══════════════════════════════════════════════════════════════════════════════
 * 3. TEXTO / LISTAS
 * ══════════════════════════════════════════════════════════════════════════════ */

/*
 * plural — Formata um número com a palavra correspondente, com ou sem "s".
 *   Ex.: plural(1, 'anúncio') → '1 anúncio'
 *        plural(3, 'anúncio') → '3 anúncios'
 *
 *   Em português o singular/plural destingue se por s por isso
 *   uma simples comparação com 1 é suficiente.
 */
export function plural(count, word) {
  if (count === 1) return count + ' ' + word;
  return count + ' ' + word + 's';
}

/*
 * unique — Remove duplicados de um array, preservando a ordem original.
 *
 * Porquê não usar new Set()?
 *   Um Set não garante preservação de ordem em todos os engines JS antigos.
 *   Esta implementação manual é mais explícita e funciona em todos os
 *   browsers suportados.
 */
export function unique(list) {
  const resultado = [];
  list.forEach((valor) => {
    if (!resultado.includes(valor)) resultado.push(valor);
  });
  return resultado;
}

/*
 * escapeHtml — Transforma caracteres especiais (< > " ' &) nas suas versões
 * seguras para HTML.
 *
 * Porquê é importante?
 *   Quando mostramos texto escrito pelo utilizador (título de um anúncio,
 *   nome, etc.) dentro de innerHTML, se esse texto tiver código HTML ele
 *   seria executado pelo browser. Isto chama-se XSS e é uma falha de segurança.
 *   Ao "escapar" o texto, o código aparece como texto normal e nunca corre.
 *
 *   Exemplo: <img onerror=alert(1)>  →  &lt;img onerror=alert(1)&gt;
 */
export function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}


/* ══════════════════════════════════════════════════════════════════════════════
 * 4. FAVORITOS
 * ══════════════════════════════════════════════════════════════════════════════ */

/*
 * getFavoriteIds — Devolve os IDs dos anúncios favoritos do utilizador.
 *
 * Buscamos apenas "item_id" (em vez de todos os campos) para minimizar
 * os dados transferidos — só precisamos de saber quais IDs estão favoritados.
 */
export async function getFavoriteIds(userId) {
  const { data } = await supabase.from('favorito').select('item_id').eq('user_id', userId);
  const lista = data || [];
  return lista.map((row) => row.item_id);
}

/*
 * addFavorite / removeFavorite — Operações simples de INSERT e DELETE
 * na tabela "favorito". São funções separadas para que cada página possa
 * chamar apenas o que precisa, sem lógica condicional aqui dentro.
 */
export function addFavorite(userId, itemId) {
  return supabase.from('favorito').insert({ user_id: userId, item_id: itemId });
}

export function removeFavorite(userId, itemId) {
  return supabase.from('favorito').delete().eq('user_id', userId).eq('item_id', itemId);
}


/* ══════════════════════════════════════════════════════════════════════════════
 * 5. CONVERSAS / CHAT
 * ══════════════════════════════════════════════════════════════════════════════ */

/*
 * startConversation — Devolve o ID de uma conversa existente ou cria uma nova.
 *
 * Porquê usar maybeSingle em vez de single?
 *   single() lança erro se não encontrar nenhuma linha.
 *   maybeSingle() devolve null sem erro, o que é o comportamento correto
 *   quando a conversa ainda não existe.
 *
 * Regra de negócio: existe no máximo UMA conversa por par (item + comprador),
 * independentemente de quantas mensagens já foram trocadas.
 */
async function startConversation(itemId, sellerId, buyerId) {
  const { data: existente } = await supabase
    .from('conversa')
    .select('id')
    .eq('item_id', itemId)
    .eq('buyer_id', buyerId)
    .maybeSingle();

  if (existente) return existente.id;

  const { data, error } = await supabase
    .from('conversa')
    .insert({ item_id: itemId, buyer_id: buyerId, seller_id: sellerId })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}


/* ══════════════════════════════════════════════════════════════════════════════
 * 6. COMPRA
 * ══════════════════════════════════════════════════════════════════════════════ */

/*
 * buyItem — Orquestra o processo de compra de um anúncio.
 *
 * Fluxo:
 *   1. Verifica que há sessão (redireciona para login se não houver).
 *   2. Carrega o anúncio para validar o estado atual (disponível, dono, etc.).
 *   3. Pede confirmação ao utilizador.
 *   4. Marca o anúncio como "vendido" na base de dados.
 *   5. Cria (ou reutiliza) a conversa com o vendedor e redireciona para lá.
 *
 * Porquê validar no cliente E no servidor?
 *   A validação aqui dá feedback imediato ao utilizador.
 *   As RLS policies no Supabase garantem que mesmo que o cliente
 *   seja manipulado, a operação falha no servidor se as condições
 *   não forem cumpridas.
 *
 * Devolve true se a compra foi concluída, false em qualquer outro caso.
 */
export async function buyItem(itemId) {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return false;
  }

  const { data: item } = await supabase
    .from('item')
    .select('id, title, sell_status, seller_id')
    .eq('id', itemId)
    .single();

  if (!item) {
    alert('Anúncio não encontrado.');
    return false;
  }

  if (item.seller_id === user.id) {
    alert('Este anúncio é teu.');
    return false;
  }

  const estado = item.sell_status || 'disponivel';
  if (estado !== 'disponivel') {
    alert('Este anúncio já não está disponível.');
    return false;
  }

  if (!confirm('Comprar "' + item.title + '"? O anúncio fica marcado como vendido e abre uma conversa com o vendedor.')) {
    return false;
  }

  /*
   * Pedimos o ".select('id')" para o Supabase nos devolver as linhas que
   * realmente alterou. Isto é importante: se o servidor não permitir marcar
   * o item como vendido (por falta de permissões), NÃO vem um "error", mas a
   * lista "vendido" vem vazia. Sem esta verificação, a app diria "compra feita"
   * mesmo quando o item continua à venda.
   */
  const { data: vendido, error } = await supabase
    .from('item')
    .update({ sell_status: 'vendido' })
    .eq('id', itemId)
    .select('id');

  if (error || !vendido || vendido.length === 0) {
    console.error('Erro ao comprar:', error);
    alert('Não foi possível concluir a compra. Tenta novamente mais tarde.');
    return false;
  }

  /*
   * Após marcar o item como vendido, abrimos (ou reutilizamos) o chat
   * com o vendedor para que comprador e vendedor possam combinar a entrega.
   * Em caso de erro ao criar a conversa, redirecionamos para a lista de
   * mensagens de qualquer forma — a compra já foi registada.
   */
  try {
    const conversaId = await startConversation(item.id, item.seller_id, user.id);
    window.location.href = 'messages.html?c=' + conversaId;
  } catch (err) {
    console.error('Erro ao abrir conversa:', err);
    window.location.href = 'messages.html';
  }

  return true;
}


/* ══════════════════════════════════════════════════════════════════════════════
 * 7. FORMATAÇÃO / LABELS
 * ══════════════════════════════════════════════════════════════════════════════ */

/*
 * formatPrice — Formata um número como moeda em euros (pt-PT).
 *
 * Porquê usar Intl.NumberFormat em vez de .toFixed(2) + '€'?
 *   O Intl.NumberFormat respeita as convenções locais (separador decimal
 *   com vírgula em PT, símbolo correto, etc.) e é a abordagem recomendada
 *   para internacionalização em JavaScript moderno.
 */
export function formatPrice(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 'Preço indisponível';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(number);
}

/*
 * wearLabels — Mapa entre os valores guardados na base de dados (chaves técnicas)
 * e os textos legíveis pelo utilizador. Centralizado aqui para que formulários
 * e cartões usem sempre as mesmas etiquetas.
 */
const wearLabels = {
  novo: 'Novo',
  como_novo: 'Como novo',
  bom: 'Bom',
  satisfatorio: 'Satisfatório'
};

export function getWearLabel(value) {
  return wearLabels[value] || value || 'Sem estado';
}


/* ══════════════════════════════════════════════════════════════════════════════
 * 8. IMAGENS
 * ══════════════════════════════════════════════════════════════════════════════ */

/*
 * getPrimaryImage — Devolve o URL da imagem principal de um anúncio.
 *
 * Lógica de fallback em cascata:
 *   1. Imagem marcada como principal (is_principal = true).
 *   2. Primeira imagem da lista (se não houver principal definida).
 *   3. Ícone genérico da app (se não houver imagens de todo).
 *
 * Porquê o fallback ao logo?
 *   Garante que os cartões de anúncio têm sempre uma imagem,
 *   mesmo que o vendedor não tenha carregado fotografias.
 */
export function getPrimaryImage(item, fallback) {
  if (!fallback) fallback = '../assets/icons/logo.svg';
  const images = item.item_image || [];
  const principal = images.find((img) => img.is_principal);

  if (principal) return principal.image_url;
  if (images.length > 0) return images[0].image_url;
  return fallback;
}

/*
 * buildStoragePath — Constrói o caminho único para guardar uma imagem no
 * Supabase Storage.
 *
 * Estrutura: userId/itemId/timestamp-indice-nomeficheiro
 *   • userId e itemId agrupam as imagens de forma organizada.
 *   • O timestamp + índice garantem unicidade, evitando colisões quando
 *     o utilizador carrega várias imagens com o mesmo nome.
 *   • Espaços são substituídos por hífens para evitar problemas de URL.
 */
function buildStoragePath(userId, itemId, file, index) {
  const nomeLimpo = file.name.toLowerCase().replaceAll(' ', '-');
  return userId + '/' + itemId + '/' + Date.now() + '-' + (index + 1) + '-' + nomeLimpo;
}

/*
 * uploadItemImages — Faz upload de um array de imagens para o Storage
 * e regista os metadados na tabela "item_image".
 *
 * Porquê fazer o upload sequencialmente (for loop) em vez de Promise.all?
 *   O Supabase Storage tem limites de pedidos simultâneos. O loop sequencial
 *   é mais seguro e evita erros de rate-limit, ao custo de ser um pouco
 *   mais lento — aceitável para no máximo 5 imagens.
 *
 * A primeira imagem (index === 0) é automaticamente marcada como principal.
 */
export async function uploadItemImages(itemId, userId, files) {
  if (!files.length) return;

  const imageRows = [];

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const path = buildStoragePath(userId, itemId, file, index);

    const { error: uploadError } = await supabase.storage
      .from('listing-images')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    /*
     * getPublicUrl devolve o URL público do ficheiro sem fazer outro pedido
     * à rede — o Supabase gera o URL deterministicamente com base no path.
     */
    const { data: publicUrlData } = supabase.storage
      .from('listing-images')
      .getPublicUrl(path);

    imageRows.push({
      item_id: itemId,
      image_url: publicUrlData.publicUrl,
      is_principal: index === 0
    });
  }

  const { error } = await supabase.from('item_image').insert(imageRows);
  if (error) throw error;
}

/*
 * deleteItemImages — Apaga as imagens de um anúncio tanto do Storage
 * como da tabela "item_image".
 *
 * Porquê apagar em duas etapas?
 *   O Supabase Storage e a base de dados são sistemas separados.
 *   Se apagássemos só o registo em item_image, os ficheiros ficariam
 *   a ocupar espaço no Storage indefinidamente (ficheiros órfãos).
 *
 * Porquê extrair o path do URL com indexOf?
 *   O URL público tem a forma ".../storage/v1/object/public/listing-images/path"
 *   — extraímos apenas a parte após "/listing-images/" para passar ao
 *   método de remoção do Storage.
 */
export async function deleteItemImages(itemId) {
  const { data: images } = await supabase
    .from('item_image')
    .select('image_url')
    .eq('item_id', itemId);

  if (!images || images.length === 0) return;

  const marker = '/listing-images/';
  const paths = [];
  images.forEach((img) => {
    const idx = img.image_url.indexOf(marker);
    if (idx !== -1) {
      paths.push(decodeURIComponent(img.image_url.substring(idx + marker.length)));
    }
  });

  if (paths.length) await supabase.storage.from('listing-images').remove(paths);
  await supabase.from('item_image').delete().eq('item_id', itemId);
}


/* ══════════════════════════════════════════════════════════════════════════════
 * 9. HELPERS DE INTERFACE (UI)
 * ══════════════════════════════════════════════════════════════════════════════ */

/*
 * createBadge — Cria o HTML de uma etiqueta visual ("badge").
 * Função interna usada por renderItemCard para manter o template HTML
 * consistente em toda a app.
 */
function createBadge(text) {
  return '<span class="badge">' + escapeHtml(text) + '</span>';
}

/*
 * renderNotice — Substitui o conteúdo de um contentor por uma caixa de aviso.
 *
 * Usado para estados vazios (sem anúncios, sem favoritos) e erros de
 * carregamento, em vez de deixar o contentor completamente vazio (o que
 * seria confuso para o utilizador).
 *
 * type: 'neutral' | 'success' | 'danger'
 * center: true para centrar o texto (útil em grids vazios)
 */
export function renderNotice(container, message, type, center) {
  if (!container) return;
  if (!type) type = 'neutral';
  let classes = 'alert alert--' + type;
  if (center) classes += ' alert--center';
  container.innerHTML = '<div class="' + classes + '">' + message + '</div>';
}

/*
 * showAlert — Mostra uma mensagem de feedback no topo de um contentor
 * (tipicamente um formulário), removendo qualquer alerta anterior.
 *
 * Porquê prepend em vez de append?
 *   O alerta aparece antes dos campos do formulário, tornando-o visível
 *   mesmo que o utilizador não faça scroll.
 */
export function showAlert(container, type, message) {
  if (!container) return;
  const anterior = container.querySelector('.alert');
  if (anterior) anterior.remove();
  const div = document.createElement('div');
  div.className = 'alert-' + type;
  div.textContent = message;
  container.prepend(div);
}



/*
 * setButtonLoading — Ativa/desativa o estado de carregamento de um botão.
 *
 * Desativar o botão (disabled = true) durante operações assíncronas impede
 * submissões duplicadas. O texto muda para dar feedback visual imediato,
 * evitando que o utilizador pense que o clique não funcionou.
 */
export function setButtonLoading(button, isLoading, loadingText, idleText) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : idleText;
}

/*
 * HEART_FILLED / HEART_OUTLINE — SVGs do ícone de coração para o botão
 * de favorito. Guardados como constantes exportadas para que dashboard.js
 * e item.js usem exatamente o mesmo SVG, evitando inconsistências visuais.
 */
export const HEART_FILLED = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
export const HEART_OUTLINE = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

/*
 * renderItemCard — Gera o HTML completo de um cartão de anúncio.
 *
 * Porquê uma única função para todos os contextos?
 *   O mesmo cartão aparece no dashboard, favoritos e perfil. Ter uma função
 *   central garante consistência visual e facilita alterações futuras.
 *
 * Opções disponíveis (objeto "options"):
 *   showCategory   → mostra a badge da categoria (dashboard).
 *   isFavorite     → determina se o coração aparece cheio.
 *   showFav        → mostra/esconde o botão de favorito (false no perfil).
 *   removable      → substitui o coração por um botão "Remover" (favoritos).
 *   showBuy        → mostra o botão "Comprar" se disponível (dashboard).
 *   currentUserId  → necessário para não mostrar "Comprar" nos próprios itens.
 *
 * Porquê usar innerHTML e templates literais em vez de createElement?
 *   Para um componente de lista com muitos elementos, construir o HTML
 *   com strings e fazer um único innerHTML = ... é significativamente
 *   mais rápido do que criar cada elemento DOM individualmente.
 */
export function renderItemCard(item, options) {
  if (!options) options = {};
  const showCategory = options.showCategory === true;
  const isFavorite = options.isFavorite === true;
  const showFav = options.showFav !== false;
  const removable = options.removable === true;
  const showBuy = options.showBuy === true;
  const currentUserId = options.currentUserId || null;

  const imageUrl = getPrimaryImage(item);
  const wearLabel = getWearLabel(item.wear_status);

  let categoryBadge = '';
  if (showCategory) {
    const nomeCategoria = (item.categoria && item.categoria.name) || 'Sem categoria';
    categoryBadge = createBadge(nomeCategoria);
  }

  let favButton = '';
  if (showFav && !removable) {
    const favClass = isFavorite ? 'fav-btn fav-btn--active' : 'fav-btn';
    const favLabel = isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
    const favIcon = isFavorite ? HEART_FILLED : HEART_OUTLINE;
    favButton = '<button class="' + favClass + '" type="button" data-fav-item="' + item.id + '" aria-label="' + favLabel + '">' + favIcon + '</button>';
  }

  let removeFooter = '';
  if (removable) {
    removeFooter = `<div style="padding: 0 18px 18px;">
          <button class="btn btn--danger-soft btn--full" type="button" data-remove-fav="${item.id}">
            Remover dos favoritos
          </button>
        </div>`;
  }

  let buyFooter = '';
  if (showBuy) {
    const isOwn = currentUserId && item.seller_id === currentUserId;
    const available = (item.sell_status || 'disponivel') === 'disponivel';
    if (!isOwn && available) {
      buyFooter = `<div style="padding: 0 18px 18px;">
          <button class="btn btn--primary btn--full" type="button" data-buy-item="${item.id}">Comprar</button>
        </div>`;
    } else if (!isOwn && !available) {
      /*
       * Se o item não está disponível, mostramos o estado (Reservado/Vendido)
       * em vez do botão, para que o utilizador perceba que já não pode comprar.
       */
      const soldLabel = item.sell_status === 'reservado' ? 'Reservado' : 'Vendido';
      buyFooter = '<div style="padding: 0 18px 18px;">' + createBadge(soldLabel) + '</div>';
    }
  }

  return `
      <div class="listing-card" style="display: flex; flex-direction: column;">
        ${favButton}
        <a href="item.html?id=${item.id}" style="flex: 1; display: flex; flex-direction: column; text-decoration: none; color: inherit;">
          <div class="listing-card__media">
            <img class="cardimg" src="${imageUrl}" alt="${escapeHtml(item.title || 'Anúncio')}" loading="lazy">
          </div>
          <div class="listing-card__body" style="flex: 1;">
            <h2 class="listing-card__title">${escapeHtml(item.title || 'Sem título')}</h2>
            <p class="listing-card__text">${escapeHtml(item.description || 'Sem descrição disponível.')}</p>
            <div class="badge-list">
              ${categoryBadge}
              ${createBadge(wearLabel)}
            </div>
            <p class="detail-price" style="font-size: 1.1rem;">${formatPrice(item.price)}</p>
          </div>
        </a>
        ${buyFooter}
        ${removeFooter}
      </div>
    `;
}

/*
 * renderImageGrid — Desenha uma grelha de imagens num contentor.
 *
 * Porquê loading="lazy"?
 *   O atributo lazy faz com que o browser só descarregue uma imagem quando
 *   está prestes a entrar na viewport, reduzindo o consumo de dados e
 *   acelerando o carregamento inicial da página.
 *
 * Parâmetros:
 *   container    → elemento onde renderizar a grelha.
 *   images       → lista de objetos { image_url }.
 *   tileClass    → classe CSS de cada moldura.
 *   alt          → texto alternativo para acessibilidade.
 *   emptyMessage → texto a mostrar se não houver imagens.
 */
export function renderImageGrid(container, images, tileClass, alt, emptyMessage) {
  if (!container) return;

  if (!images || images.length === 0) {
    container.innerHTML = '<div class="alert alert--neutral alert--center">' + emptyMessage + '</div>';
    return;
  }

  container.innerHTML = images.map((img) =>
    '<div class="' + tileClass + '"><img src="' + img.image_url + '" alt="' + alt + '" loading="lazy"></div>'
  ).join('');
}

/*
 * renderImagePreview — Mostra pré-visualizações locais das imagens
 * selecionadas pelo utilizador, ANTES de as enviar para o servidor.
 *
 * Porquê URL.createObjectURL?
 *   Cria um URL temporário que aponta para o ficheiro na memória local
 *   (sem fazer qualquer pedido à rede), permitindo mostrar a imagem
 *   imediatamente após a seleção.
 */
function renderImagePreview(files, container) {
  if (!container) return;
  container.innerHTML = '';

  files.forEach((file) => {
    const url = URL.createObjectURL(file);
    const tile = document.createElement('div');
    tile.className = 'preview-tile';
    tile.innerHTML = '<img src="' + url + '" alt="Preview" loading="lazy">';
    container.appendChild(tile);
  });
}

/*
 * initFilePicker — Liga um <input type="file"> à pré-visualização e ao
 * texto de nome dos ficheiros selecionados.
 *
 * .slice(0, 5) limita a seleção a 5 imagens no máximo, coerente com
 * o limite imposto no uploadItemImages.
 */
export function initFilePicker(input, fileNameEl, previewEl) {
  if (!input || !fileNameEl) return;

  input.addEventListener('change', () => {
    const files = Array.from(input.files || []).slice(0, 5);
    fileNameEl.textContent = files.map((f) => f.name).join(', ') || 'Nenhuma fotografia seleccionada';
    renderImagePreview(files, previewEl);
  });
}


/* ══════════════════════════════════════════════════════════════════════════════
 * 10. BASE DE DADOS
 * ══════════════════════════════════════════════════════════════════════════════ */

/*
 * loadCategories — Preenche um <select id="listing-category"> com as
 * categorias da base de dados.
 *
 * Porquê carregar do servidor em vez de ter a lista em código?
 *   As categorias são geridas pelo admin em tempo real. Carregar do
 *   servidor garante que os formulários mostram sempre a lista atualizada
 *   sem precisar de atualizar o código da app.
 *
 * selectedId — quando fornecido (página de edição), a opção correspondente
 * fica pré-selecionada, poupando trabalho ao utilizador.
 */
export async function loadCategories(selectedId) {
  if (!selectedId) selectedId = null;
  const select = document.getElementById('listing-category');
  if (!select) return;

  try {
    const { data, error } = await supabase.from('categoria').select('id,name').order('name');
    if (error) throw error;

    if (!data || data.length === 0) {
      select.innerHTML = '<option value="" disabled selected>Sem categorias disponíveis</option>';
      return;
    }

    select.innerHTML = '<option value="" disabled selected>Seleciona...</option>';
    data.forEach((c) => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.name;
      if (c.id === selectedId) option.selected = true;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Erro a carregar categorias:', err);
    select.innerHTML = '<option value="" disabled selected>Erro ao carregar categorias</option>';
  }
}
             