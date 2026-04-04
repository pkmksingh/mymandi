const CACHE_NAME = 'mandi-shell-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/upiqr.jpeg'
];

// Install Event - Caching the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event - Clearing old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)));
    })
  );
});

// Fetch Event - Intercepting network requests
self.addEventListener('fetch', (event) => {
  // Navigation request - serve index.html (SPA support)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Only handle GET requests for internal assets
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
// Push Notification Event
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();

  if (data.type === 'CALL') {
    const options = {
      body: `${data.callerName} is calling you!`,
      icon: data.callerSelfie || '/upiqr.jpeg',
      badge: '/favicon.svg',
      tag: 'incoming-call',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: '/', fromId: data.from },
      actions: [
        { action: 'answer', title: 'Answer' },
        { action: 'decline', title: 'Decline' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification('Incoming Call ☎️', options)
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let c of clientList) {
          if (c.focused) {
            client = c;
            break;
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
