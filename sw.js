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
 * Estratégia: Network-First (internet primeiro, cache em reserva)
 *   Tenta sempre ir à rede buscar a versão mais recente; se a rede falhar
 *   (utilizador offline), serve a cópia guardada em cache.
 *   Vantagem: o utilizador vê sempre o código mais recente quando tem
 *   internet, sem ficar "preso" a uma versão antiga.
 *   Desvantagem: ligeiramente mais lento que cache-first, pois espera
 *   pela rede antes de recorrer à cache.
 *   (Ver detalhe no handler do evento "fetch" mais abaixo.)
 */

/*
 * CACHE_NAME — identificador único desta versão da cache.
 *
 * Porquê incluir um número de versão?
 *   Quando o código é atualizado, mudamos este nome (ex.: 'app-shell-v15').
 *   O evento "activate" apaga automaticamente as caches com nomes diferentes,
 *   forçando o browser a descarregar os ficheiros atualizados.
 */
const CACHE_NAME = 'app-shell-v0';

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
	'/pages/messages.html',
	'/assets/icons/logo.svg',
	'/assets/icons/Vector.svg',
	'/assets/icons/Vector1.svg',
	'/assets/icons/Vector2.svg',
	'/assets/icons/Vector3.svg',
	'/assets/icons/Vector4.svg'
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
	/*
	 * self.skipWaiting() faz o novo SW ativar-se imediatamente, sem ficar em
	 * estado "waiting" à espera que todos os separadores antigos fechem.
	 * Combinado com clients.claim() no "activate", garante que uma nova versão
	 * (e a limpeza das caches antigas) entra em vigor logo no recarregamento.
	 */
	self.skipWaiting();

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
		).then(() => self.clients.claim())
		/*
		 * self.clients.claim() faz este SW assumir o controlo das páginas já
		 * abertas de imediato (sem ser preciso recarregar duas vezes), para que
		 * a nova versão passe a servir os pedidos logo após ativar.
		 */
	);
});

/*
 * Evento "fetch" — interceta TODOS os pedidos de rede feitos pela app.
 *
 * Porquê filtrar apenas pedidos GET?
 *   Pedidos POST, PUT, DELETE (ex.: inserções na BD via Supabase) não devem
 *   ser servidos da cache — precisam sempre de chegar ao servidor.
 *
 * Estratégia: Internet primeiro, cache em reserva (Network-First)
 *   1. Tentamos sempre ir à internet buscar a versão mais recente.
 *   2. Se conseguirmos, guardamos uma cópia na cache (para uso offline) e
 *      devolvemos essa versão fresca.
 *   3. Se a internet falhar (utilizador offline), devolvemos a cópia guardada.
 *
 *   Vantagem face à cache-first anterior: o utilizador vê sempre o código mais
 *   recente quando tem internet (deixa de ficar "preso" a uma versão antiga),
 *   e a app continua a abrir offline graças à cópia guardada.
 */
self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	event.respondWith(
		fetch(event.request)
			.then((response) => {
				/*
				 * Guardamos uma cópia da resposta na cache para poder ser usada
				 * offline mais tarde. Usamos .clone() porque uma resposta só
				 * pode ser "lida" uma vez — uma cópia vai para a cache, a outra
				 * é devolvida à página.
				 */
				const copia = response.clone();
				caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
				return response;
			})
			.catch(() => caches.match(event.request))
	);
});
