// ========================================
// SERVICE WORKER — GUÍA COR v6
// Estrategias:
//  - Navegación (documento): NETWORK FIRST (cambios en producción se ven sin limpiar caché)
//  - data/* (guia.json):     NETWORK FIRST con respaldo a caché
//  - Estáticos (css/js):     STALE-WHILE-REVALIDATE (respuesta inmediata + actualiza en segundo plano)
//
// v6: bump forzado para que los dispositivos con la caché v5 (mezcla de
// archivos de deploys anteriores que dejaba el login colgado) descarguen
// todo de nuevo con skipWaiting + claim.
// ========================================

const STATIC_CACHE = 'guia-cor-static-v6';
const DATA_CACHE = 'guia-cor-data-v6';

const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/app.js',
    './js/state.js',
    './js/utils/crypto.js',
    './js/utils/storage.js',
    './js/utils/debounce.js',
    './js/utils/sanitize.js',
    './js/workers/search.worker.js',
    './js/modules/auth.js',
    './js/modules/theme.js',
    './js/modules/navigation.js',
    './js/modules/search.js',
    './js/modules/home.js',
    './js/modules/dashboard.js',
    './js/modules/calendar.js',
    './js/modules/calendar_tool.js',
    './js/modules/cdc.js',
    './js/modules/panel.js',
    './js/modules/guardia.js',
    './js/modules/mail.js',
    './js/modules/notifications.js',
    './js/modules/profile.js',
    './js/modules/settings.js',
    './js/modules/impacto.js',
    './js/modules/error_monitor.js',
    './js/modules/states.js',
    './js/modules/firebase.js',
    './js/modules/launcher.js',
    './data/guia.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// Instalación: precachea todo lo que pueda (sin abortar por un archivo que falle)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => Promise.allSettled(urlsToCache.map(u => cache.add(u))))
            .then(() => self.skipWaiting())
    );
});

// Permite que la página le pida al SW esperando que se active YA (evita
// quedarse con una mezcla de archivos de deploys distintos).
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Activación: limpia caches de versiones anteriores, toma control y recarga
// las páginas abiertas para que tomen la versión nueva YA (no depende del JS
// de la página: cura el login colgado por mezcla de archivos de deploys viejos).
self.addEventListener('activate', event => {
    const whitelist = [STATIC_CACHE, DATA_CACHE];
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => !whitelist.includes(k)).map(k => caches.delete(k))
        ))
            .then(() => self.clients.claim())
            .then(() => self.clients.matchAll({ type: 'window' }))
            .then(clients => Promise.all(clients.map(c => c.navigate(c.url).catch(() => {}))))
    );
});

// Intercepta solicitudes con estrategias diferenciadas
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET') return;

    // Navegación (documento HTML): red primero, caché como respaldo
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const copy = response.clone();
                    caches.open(STATIC_CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
                    return response;
                })
                .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
        );
        return;
    }

    // Datos dinámicos (guia.json): red primero con respaldo a caché
    if (url.pathname.includes('/data/')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.status === 200) {
                        const copy = response.clone();
                        caches.open(DATA_CACHE).then(c => c.put(event.request, copy)).catch(() => {});
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Estáticos (css/js/imágenes): stale-while-revalidate
    event.respondWith(
        caches.match(event.request).then(cached => {
            const networkFetch = fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const copy = response.clone();
                    caches.open(STATIC_CACHE).then(c => c.put(event.request, copy)).catch(() => {});
                }
                return response;
            }).catch(() => cached);
            return cached || networkFetch;
        })
    );
});
