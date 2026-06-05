const CACHE_NAME = 'vethome-pro-v10-schnauzer-2026-06-05-06';
const APP_SHELL = [
    '/',
    '/index.html',
    '/style.css',
    '/manifest.webmanifest',
    '/icon.svg',
    '/js/00-supabase.js',
    '/js/01-database.js',
    '/js/01-core.js',
    '/js/02-firmas.js',
    '/js/03-pdf.js',
    '/js/04-consultas.js',
    '/js/05-clientes.js',
    '/js/06-agenda.js',
    '/js/07-inventario-finanzas.js',
    '/js/08-main.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
    event.respondWith(
        fetch(event.request)
            .then(response => {
                const copy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                return response;
            })
            .catch(() => caches.match(event.request).then(cached => cached || caches.match('/index.html')))
    );
});
