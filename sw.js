/*
 * sw.js — Service Worker da aplicação (PWA).
 *
 * O que é um Service Worker?
 *   É um script que o browser executa num thread separado, entre a app e
 *   a rede. Não tem acesso ao DOM, mas pode intercetrar pedidos de rede,
 *   gerir caches e permitir que a app funcione offline.
 *
 * Porquê esta app tem um Service Worker?
 *   Para se comportar como uma PWA (Progressive Web App) — pode ser
 *   instalada no telemóvel como uma app nativa e funciona mesmo sem
 *   ligação à internet (serve os ficheiros da cache).
 *
 * Ciclo de vida do Service Worker:
 *   1. install  → descarrega e guarda os assets em cache.
 *   2. activate → limpa caches antigas de versões anteriores.
 *   3. fetch    → interceta pedidos e serve da cache (ou da rede).
 *
 * Estratégia: Cache-First
 *   Tenta servir da cache; se o recurso não estiver em cache, vai à rede.
 *   Vantagem: carregamento muito rápido após a primeira visita.
 *   Desvantagem: alterações ao código só são refletidas quando o SW
 *   é atualizado (nova versão de CACHE_NAME).
 */

/*
 * CACHE_NAME — identificador único desta versão da cache.
 *
 * Porquê incluir um número de versão?
 *   Quando o código é atualizado, mudamos este nome (ex.: 'app-shell-v15').
 *   O evento "activate" apaga automaticamente as caches com nomes diferentes,
 *   forçando o browser a descarregar os ficheiros atualizados.
 */
const CACHE_NAME = 'app-shell-v14';

/*
 * ASSETS — lista de ficheiros a guardar em cache durante a instalação.
 *
 * Inclui toda a "shell" da app: HTML, CSS, JS e assets necessários para
 * que qualquer página funcione offline. Se um ficheiro desta lista não
 * existir no servidor, a instalação do SW falha — por isso a lista deve
 * estar sempre atualizada.
 */
const ASSETS = [
	'/',
	'/index.html',
	'/manifest.json',
	'/styles/styles.css',
	'/js/sw-register.js',
	'/js/pages/app.js',
	'/js/auth/auth.js',
	'/js/auth/auth-guard.js',
	'/js/pages/auth.js',
	'/js/pages/publish.js',
	'/js/pages/item.js',
	'/js/pages/dashboard.js',
	'/js/pages/edit.js',
	'/js/pages/admin.js',
	'/js/pages/favorites.js',
	'/js/pages/profile.js',
	'/js/pages/messages.js',
	'/js/utils/utils.js',
	'/js/config/supabaseClient.js',
	'/pages/admin.html',
	'/pages/profile.html',
	'/pages/dashboard.html',
	'/pages/item.html',
	'/pages/edit.html',
	'/pages/publish.html',
	'/pages/favorites.html',
	'/pages/login.html',
	'/pages/register.html',
	'/pages/messages.html'
];

/*
 * Evento "install" — corre uma vez quando o SW é registado pela primeira vez
 * (ou quando CACHE_NAME muda).
 *
 * event.waitUntil() garante que o SW não avança para "activate" enquanto o
 * cache.addAll() não terminar — se qualquer ficheiro falhar, a instalação é
 * abortada e o SW anterior continua ativo (sem downtime).
 */
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
	);
});

/*
 * Evento "activate" — corre após a instalação, quando o SW "toma posse"
 * das páginas abertas.
 *
 * Aqui apagamos todas as caches cujo nome não seja o CACHE_NAME atual.
 * Porquê?
 *   Versões antigas do SW deixam caches com nomes diferentes (ex.:
 *   'app-shell-v13'). Sem esta limpeza, essas caches ficariam a ocupar
 *   espaço no disco do utilizador indefinidamente.
 *
 * caches.keys() devolve todos os nomes de cache existentes.
 * O filter() seleciona os que não correspondem à versão atual.
 * Promise.all() apaga todos em paralelo.
 */
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
			)
		)
	);
});

/*
 * Evento "fetch" — interceta TODOS os pedidos de rede feitos pela app.
 *
 * Porquê filtrar apenas pedidos GET?
 *   Pedidos POST, PUT, DELETE (ex.: inserções na BD via Supabase) não devem
 *   ser servidos da cache — precisam sempre de chegar ao servidor.
 *
 * Estratégia Cache-First:
 *   caches.match() procura o recurso em todas as caches existentes.
 *   Se encontrar (hit), devolve imediatamente sem ir à rede.
 *   Se não encontrar (miss), faz o pedido normal à rede com fetch().
 *
 *   Para pedidos à API do Supabase (dados dinâmicos), caches.match()
 *   devolverá sempre undefined, pelo que esses pedidos vão sempre à rede.
 */
self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	event.respondWith(
		caches.match(event.request).then((cached) => cached || fetch(event.request))
	);
});
