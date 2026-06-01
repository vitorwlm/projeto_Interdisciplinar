const CACHE_NAME = 'app-shell-v2';
const ASSETS = [
	'/',
	'/index.html',
	'/manifest.json',
	'/styles/bulma.css',
	'/styles/styles.css',
	'/js/app.js',
	'/js/auth.js',
	'/js/auth-guard.js',
	'/js/item.js',
	'/js/dashboard.js',
	'/js/item-detail.js'
];

self.addEventListener('install', (event) => {
	self.skipWaiting();
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys
					.filter((key) => key !== CACHE_NAME)
					.map((key) => caches.delete(key))
			)
		).then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const request = event.request;

	if (request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))) {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const copy = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
					return response;
				})
				.catch(() =>
					caches.match('/index.html').then((resp) =>
						resp || new Response('<h1>Offline</h1><p>Sem ligação à internet.</p>', { headers: { 'Content-Type': 'text/html' } })
					)
				)
		);
		return;
	}
	event.respondWith(caches.match(request).then((resp) => resp || fetch(request)));
});

