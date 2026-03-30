const CACHE = 'junkyard-dog-v4';
const STATIC = ['./jd-icon-192.png', './jd-icon-512.png'];

// Install — only cache icons, not the HTML
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(STATIC);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate — delete all old caches immediately
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Always go straight to network for API calls — never cache these
  if (url.includes('googleapis.com') ||
      url.includes('anthropic.com') ||
      url.includes('microsoftonline.com') ||
      url.includes('graph.microsoft.com') ||
      url.includes('oauth2.google')) {
    return;
  }

  // For HTML, manifest, and sw.js — NETWORK FIRST
  // This means Netlify deploys always show up immediately
  if (url.includes('.html') ||
      url.includes('manifest.json') ||
      url.includes('sw.js') ||
      e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function(res) {
        // Update the cache with the fresh version
        if (res.ok) {
          var clone = res.clone();
          caches.open(CACHE).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return res;
      }).catch(function() {
        // Only fall back to cache if completely offline
        return caches.match(e.request);
      })
    );
    return;
  }

  // For icons and other static assets — cache first (they never change)
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(res) {
        if (res.ok && e.request.method === 'GET') {
          var clone = res.clone();
          caches.open(CACHE).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return res;
      });
    })
  );
});

// Push notifications
self.addEventListener('push', function(e) {
  var data = e.data ? e.data.json() : { title: 'Junkyard Dog', body: 'New update' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'Junkyard Dog', {
      body: data.body || '',
      icon: './jd-icon-192.png',
      badge: './jd-icon-192.png',
      tag: data.tag || 'jd-notification',
      renotify: true
    })
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.includes('junkyard-dog') && 'focus' in list[i]) {
          return list[i].focus();
        }
      }
      return clients.openWindow('./index.html');
    })
  );
});
