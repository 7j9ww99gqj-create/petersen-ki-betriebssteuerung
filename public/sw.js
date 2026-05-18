/* Petersen KI – Service Worker für Push-Benachrichtigungen */

self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Petersen KI';
  const options = {
    body: data.body || '',
    icon: '/logo.jpg',
    badge: '/logo.jpg',
    data: data.url ? { url: data.url } : {},
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  } else {
    event.waitUntil(clients.openWindow('/dashboard'));
  }
});

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
