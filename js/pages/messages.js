/*
 * messages.js — Sistema de mensagens entre compradores e vendedores.
 *
 * Arquitetura da página:
 *   • Painel esquerdo (lista de conversas): todas as conversas do utilizador,
 *     tanto como comprador como como vendedor.
 *   • Painel direito (chat): mensagens da conversa selecionada, com campo
 *     de envio de nova mensagem.
 *
 * Modelo de dados:
 *   "conversa" — regista a ligação entre item, comprador e vendedor.
 *   "mensagem" — cada mensagem enviada numa conversa, com sender_id e content.
 *
 * Porquê polling em vez de Realtime (WebSockets)?
 *   O Supabase Realtime exigiria configuração extra e subscriptions.
 *   O polling simples a cada 3 segundos é suficiente para uma conversa de
 *   negociação (não é um chat em tempo real exigente) e é mais fácil de
 *   implementar e depurar.
 */

import { supabase } from '../config/supabaseClient.js';
import { initPage, getCurrentUser, renderNotice, unique } from '../utils/utils.js';

await initPage();


/* ── Elementos DOM ───────────────────────────────────────────────────────── */

const layout = document.getElementById('messages-layout');
const listEl = document.getElementById('conversation-list');
const emptyEl = document.getElementById('messages-empty');
const chatPanel = document.getElementById('chat-panel');
const chatTitle = document.getElementById('chat-title');
const chatSubtitle = document.getElementById('chat-subtitle');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatBack = document.getElementById('chat-back');

/*
 * Estado de módulo:
 *   me          — utilizador autenticado (preenchido no arranque).
 *   conversations — lista de todas as conversas carregadas.
 *   activeId    — ID da conversa atualmente aberta no chat.
 *   pollTimer   — referência ao setInterval para poder limpar quando o chat fecha.
 */
let me = null;
let conversations = [];
let activeId = null;
let pollTimer = null;

/*
 * formatTime — Formata um timestamp ISO em hora legível (HH:MM).
 * Usa o locale 'pt-PT' para o formato correto (24h, sem segundos).
 */
function formatTime(value) {
  return new Date(value).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}


/* ── Lista de conversas ──────────────────────────────────────────────────── */

/*
 * loadConversations — Carrega todas as conversas onde o utilizador participa
 * (quer como comprador, quer como vendedor).
 *
 * Porquê ".or('buyer_id.eq.X,seller_id.eq.X')"?
 *   O utilizador pode ter os dois papéis em conversas diferentes.
 *   Este filtro OR devolve todas as conversas relevantes numa única query.
 *
 * Enriquecimento dos dados:
 *   Após carregar as conversas, buscamos os títulos dos itens e os nomes
 *   das outras pessoas em queries separadas com ".in()" (uma query por tipo,
 *   não uma por registo) — N+1 queries evitadas.
 */
async function loadConversations() {
  const { data, error } = await supabase
    .from('conversa')
    .select('id, item_id, buyer_id, seller_id, created_at')
    .or('buyer_id.eq.' + me.id + ',seller_id.eq.' + me.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar conversas:', error);
    renderNotice(listEl, 'Não foi possível carregar as conversas.', 'danger', true);
    return;
  }

  conversations = data || [];

  const itemIds = unique(conversations.map((c) => c.item_id).filter(Boolean));

  /*
   * "otherId" é o ID do outro participante na conversa:
   *   • Se sou o comprador → o outro é o vendedor.
   *   • Se sou o vendedor → o outro é o comprador.
   */
  const otherIds = unique(
    conversations.map((c) => (c.buyer_id === me.id ? c.seller_id : c.buyer_id)).filter(Boolean)
  );

  const itemMap = {};
  const userMap = {};

  if (itemIds.length) {
    const { data: items } = await supabase.from('item').select('id, title').in('id', itemIds);
    (items || []).forEach((i) => { itemMap[i.id] = i.title; });
  }
  if (otherIds.length) {
    const { data: users } = await supabase.from('utilizador').select('id, name').in('id', otherIds);
    (users || []).forEach((u) => { userMap[u.id] = u.name; });
  }

  /*
   * Injetar os dados enriquecidos diretamente nos objetos de conversa
   * para simplificar o render — evita ter de fazer lookups no template.
   */
  conversations.forEach((c) => {
    const otherId = c.buyer_id === me.id ? c.seller_id : c.buyer_id;
    c.itemTitle = itemMap[c.item_id] || 'Anúncio';
    c.otherName = userMap[otherId] || 'Utilizador';
    c.role = c.buyer_id === me.id ? 'A comprar' : 'A vender';
  });

  renderConversationList();
}

/*
 * renderConversationList — Desenha a lista de conversas como botões clicáveis.
 *
 * Porquê criar elementos DOM com createElement em vez de innerHTML?
 *   O conteúdo das conversas (títulos, nomes) vem da BD e pode conter
 *   caracteres especiais. Usar textContent em vez de innerHTML previne
 *   injeção de HTML (XSS) mesmo que os dados fossem maliciosos.
 *
 * A conversa ativa fica marcada com a classe "conversation-item--active"
 * para feedback visual ao utilizador.
 */
function renderConversationList() {
  if (!conversations.length) {
    if (emptyEl) emptyEl.hidden = false;
    listEl.innerHTML = '';
    return;
  }

  if (emptyEl) emptyEl.hidden = true;

  listEl.innerHTML = '';
  conversations.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = 'conversation-item';
    if (c.id === activeId) btn.classList.add('conversation-item--active');
    btn.type = 'button';

    const titulo = document.createElement('strong');
    titulo.textContent = c.itemTitle;

    const sub = document.createElement('span');
    sub.textContent = c.otherName + ' · ' + c.role;

    btn.appendChild(titulo);
    btn.appendChild(sub);
    btn.addEventListener('click', () => openChat(c.id));

    listEl.appendChild(btn);
  });
}


/* ── Chat ────────────────────────────────────────────────────────────────── */

/*
 * openChat — Abre o painel de chat para uma conversa específica.
 *
 * O polling (setInterval) é limpo antes de criar um novo para garantir
 * que nunca há dois timers a correr simultaneamente — o que causaria
 * duplicação de mensagens ou pedidos desnecessários.
 */
function openChat(conversaId) {
  const conversa = conversations.find((c) => c.id === conversaId);
  activeId = conversaId;

  if (chatTitle) chatTitle.textContent = conversa ? conversa.itemTitle : 'Conversa';
  if (chatSubtitle) chatSubtitle.textContent = conversa ? (conversa.otherName + ' · ' + conversa.role) : '';

  if (chatPanel) chatPanel.hidden = false;

  /*
   * "chat-open" é uma classe CSS que em mobile faz o painel de chat
   * ocupar o ecrã inteiro, escondendo a lista de conversas.
   */
  if (layout) layout.classList.add('chat-open');

  renderConversationList();
  loadMessages();

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(loadMessages, 3000);
}

/*
 * loadMessages — Carrega todas as mensagens da conversa ativa.
 *
 * Ordenadas por "created_at" ascendente para que as mensagens mais
 * antigas apareçam no topo (ordem cronológica natural numa conversa).
 */
async function loadMessages() {
  if (!activeId) return;

  const { data, error } = await supabase
    .from('mensagem')
    .select('id, sender_id, content, created_at')
    .eq('conversa_id', activeId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao carregar mensagens:', error);
    return;
  }

  renderMessages(data || []);
}

/*
 * renderMessages — Desenha as bolhas de mensagem no chat.
 *
 * Porquê usar textContent em vez de innerHTML para o conteúdo?
 *   O conteúdo das mensagens é texto livre introduzido pelo utilizador.
 *   Usar textContent garante que tags HTML ou scripts não são interpretados
 *   (proteção contra XSS).
 *
 * As mensagens próprias (sender_id === me.id) têm a classe "chat-bubble--mine"
 * para aparecerem à direita com cor diferente — convenção visual de chat.
 *
 * Porquê scrollTop = scrollHeight?
 *   Força o scroll até ao fundo após cada carregamento, para que a mensagem
 *   mais recente seja sempre visível sem interação do utilizador.
 */
function renderMessages(messages) {
  if (!chatMessages) return;

  if (!messages.length) {
    chatMessages.innerHTML = '<p class="chat-empty">Ainda não há mensagens. Diz olá!</p>';
    return;
  }

  chatMessages.innerHTML = '';
  messages.forEach((m) => {
    const bolha = document.createElement('div');
    bolha.className = 'chat-bubble';
    if (m.sender_id === me.id) bolha.classList.add('chat-bubble--mine');
    bolha.textContent = m.content;

    const hora = document.createElement('span');
    hora.className = 'chat-bubble__time';
    hora.textContent = formatTime(m.created_at);

    bolha.appendChild(hora);
    chatMessages.appendChild(bolha);
  });

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/*
 * closeChat — Fecha o painel de chat e limpa o polling.
 *
 * Limpar o timer é essencial para não continuar a fazer pedidos à BD
 * quando não há conversa aberta — poupança de recursos e de quota.
 */
function closeChat() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  activeId = null;
  if (layout) layout.classList.remove('chat-open');
  if (chatPanel) chatPanel.hidden = true;
  renderConversationList();
}


/* ── Eventos ─────────────────────────────────────────────────────────────── */

if (chatBack) chatBack.addEventListener('click', closeChat);

if (chatForm) {
  chatForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = chatInput.value.trim();

    /*
     * Não enviar mensagens vazias — verificação simples antes de qualquer
     * pedido à rede.
     */
    if (!content || !activeId) return;

    /*
     * Limpar o input imediatamente (antes da resposta da BD) para dar
     * a sensação de resposta rápida. Se o envio falhar, repomos o texto.
     */
    chatInput.value = '';

    const { error } = await supabase
      .from('mensagem')
      .insert({ conversa_id: activeId, sender_id: me.id, content: content });

    if (error) {
      console.error('Erro ao enviar mensagem:', error);
      chatInput.value = content;
      return;
    }

    /*
     * Recarregar as mensagens após envio para mostrar a nova mensagem
     * no chat imediatamente, sem esperar pelo próximo ciclo de polling.
     */
    await loadMessages();
  });
}


/* ── Arranque ────────────────────────────────────────────────────────────── */

me = await getCurrentUser();
if (me) {
  await loadConversations();

  /*
   * Se o URL contiver "?c=<id>" (ex.: depois de comprar um anúncio),
   * abre diretamente essa conversa. Isto evita que o utilizador tenha
   * de procurar a conversa na lista após a compra.
   */
  const conversaId = new URLSearchParams(window.location.search).get('c');
  if (conversaId) openChat(conversaId);
}
