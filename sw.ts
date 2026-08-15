/**
 * Service Worker para Minijuegos - PWA Offline Support
 * Cacha assets esenciales para permitir juego offline
 */

/// <reference lib="webworker" />
export {};
declare const self: ServiceWorkerGlobalScope;

// Background Sync API no está incluida en los tipos estándar de TypeScript
declare global {
  interface SyncEvent extends ExtendableEvent {
    readonly tag: string;
  }
  interface ServiceWorkerGlobalScopeEventMap {
    sync: SyncEvent;
  }
}

const CACHE_NAME = 'minijuegos-v3.0.0';
const STATIC_CACHE = 'minijuegos-static-v2';
const DYNAMIC_CACHE = 'minijuegos-dynamic-v2';

// Assets esenciales para cachear al inicio.
// IMPORTANTE: tras la migración a Vite, los bundles de JS/CSS se emiten con
// nombres hasheados (p.ej. dist/assets/games-tLZmfn3i.js) que cambian en
// cada build, así que NO pueden listarse aquí de forma estática — un solo
//404 en cache.addAll() aborta el precache completo. Solo precacheamos
// rutas con nombre estable; los bundles hasheados se cachean en caliente
// vía la estrategia "Network First" del handler de fetch más abajo.
// Rutas relativas al scope del propio Service Worker (self.registration.scope),
// no a la raíz del dominio: en GitHub Pages este proyecto vive en un subpath
// (/Mini-juegos/), y '/index.html' hardcodeado a raíz nunca matchea ahí.
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Instalación - cachear assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activación - limpiar caches antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              return cacheName !== STATIC_CACHE && 
                     cacheName !== DYNAMIC_CACHE &&
                     cacheName !== CACHE_NAME;
            })
            .map(cacheName => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch - servir desde cache con network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests que no son GET
  if (request.method !== 'GET') return;

  // Ignorar requests a otros dominios
  if (url.origin !== location.origin) return;

  // Estrategia: Cache First para assets estáticos
  if (STATIC_ASSETS.some(asset => url.pathname === asset)) {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            // Clonar response antes de cachear
            const responseClone = response.clone();
            void caches.open(STATIC_CACHE).then(cache => {
              return cache.put(request, responseClone);
            }).catch((err: unknown) => {
              console.error('[SW] No se pudo cachear (static):', err);
            });
            return response;
          });
        })
    );
    return;
  }

  // Estrategia: Network First para HTML y JS de juegos
  if (request.destination === 'document' || 
      request.destination === 'script' ||
      url.pathname.includes('/js/games/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clonar response antes de cachear
          const responseClone = response.clone();
          void caches.open(DYNAMIC_CACHE).then(cache => {
            return cache.put(request, responseClone);
          }).catch((err: unknown) => {
            console.error('[SW] No se pudo cachear (network-first):', err);
          });
          return response;
        })
        .catch(async () => {
          // Si falla network, intentar servir desde cache. caches.match
          // puede resolver a undefined (nunca se cacheó este request),
          // así que ese caso se cubre con un 503 explícito en vez de
          // dejar que event.respondWith() reciba undefined — lo cual
          // el navegador rechaza en runtime, no solo TypeScript.
          const cached = await caches.match(request);
          return cached ?? new Response('Sin conexión y sin copia en caché.', {
            status: 503,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // Estrategia: Cache First para CSS e imágenes
  if (request.destination === 'style' || 
      request.destination === 'image') {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            const responseClone = response.clone();
            void caches.open(DYNAMIC_CACHE).then(cache => {
              return cache.put(request, responseClone);
            }).catch((err: unknown) => {
              console.error('[SW] No se pudo cachear (cache-first):', err);
            });
            return response;
          });
        })
    );
    return;
  }

  // Para otros requests, dejar que el navegador maneje
  event.respondWith(fetch(request));
});

// Background sync para leaderboard y favoritos (opcional, para futuro)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-leaderboard') {
    event.waitUntil(syncLeaderboard());
  }
});

async function syncLeaderboard() {
  // Implementación futura para sincronizar datos cuando hay conexión
  console.log('[SW] Syncing leaderboard data');
}

// Push notifications (opcional, para futuro)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Nueva actualización disponible',
      icon: './assets/icon-192.png',
      badge: './assets/badge-72.png',
      vibrate: [200, 100, 200]
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});
