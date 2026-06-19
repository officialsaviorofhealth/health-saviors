// Health Saviors service worker — PWA + Web Push
// Version bump invalidates the cache.
const CACHE_VERSION = 'v1';
const RUNTIME_CACHE = `hs-runtime-${CACHE_VERSION}`;

// On install, just take over ASAP.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clear old caches
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== RUNTIME_CACHE).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Network-first for navigation; cache-first for static assets.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never intercept API calls — always go to network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/data/')) return;

  // Navigation requests — network first, fall back to cached page
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then(r => r || caches.match('/')))
    );
    return;
  }

  // Static assets (JS/CSS/images): cache-first, then network
  if (/\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|json)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) {
          // Refresh in background
          fetch(req).then(r => r.ok && cache.put(req, r.clone())).catch(() => {});
          return cached;
        }
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      })
    );
  }
});

// ── Push notifications ──
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Health Saviors', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Health Saviors';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag,                   // collapses duplicates with same tag
    renotify: !!payload.renotify,
    requireInteraction: !!payload.requireInteraction,
    silent: !!payload.silent,
    data: {
      url: payload.url || '/',
      ...(payload.data || {}),
    },
    actions: payload.actions || [],
    image: payload.image,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Click on a notification — focus existing tab or open a new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        const url = new URL(client.url);
        if (url.pathname === targetUrl || url.href.endsWith(targetUrl)) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});

// If subscription is invalidated by the push service, ask the page to re-subscribe.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        client.postMessage({ type: 'pushsubscriptionchange' });
      }
    })()
  );
});
