/* Petersen KI – Service Worker
 * - Push-Benachrichtigungen
 * - Network-first für HTML/Navigation (immer aktuelle App)
 * - Cache-first für /icon-*, /logo.* und /pondruff/* (Bilder)
 */

const VERSION = 'v3-2026-05-19';
const CACHE = `pk-static-${VERSION}`;
const STATIC_ASSETS = [
  '/manifest.json',
  '/logo.jpg',
  '/icon-96.png',
  '/icon-144.png',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Nur same-origin behandeln
  if (url.origin !== self.location.origin) return;

  // Bilder + statische Icons → Cache-first
  const isStaticImage = /\/icon-\d+\.png$|\/logo\.|\/pondruff\/.*\.(png|jpg|jpeg|webp)$|\/manifest\.json$/.test(url.pathname);
  if (isStaticImage) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached || new Response('', { status: 504 }));
      })
    );
    return;
  }

  // Alles andere (HTML, JSON, API) → Network-first, kein Caching
  // (verhindert dass Auth-Cookies oder veraltete Daten ausgeliefert werden)
});

self.addEventListener('push', (event) => {
  const data = event.data ? (() => { try { return event.data.json(); } catch { return {}; } })() : {};
  const title = data.title || 'Petersen KI';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    data: data.url ? { url: data.url } : {},
    requireInteraction: false,
    vibrate: [200, 100, 200],
    tag: data.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) {
          w.navigate(url).catch(() => {});
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
