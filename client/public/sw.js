/**
 * VibeGrid Progressive Web App Service Worker
 * Version: vibegrid-pwa-v53
 * Updated: Auto-generated with enhanced offline caching, sync fallbacks, and instant update activation.
 * 
 * Features:
 * 1. Safe static asset caching & Network-First navigation
 * 2. Instant offline fallback page for navigation requests when disconnected
 * 3. Strict Network-Only bypass for sensitive/authenticated endpoints (auth, E2EE messages, WebRTC calls)
 * 4. Automatic cache cleanup on deployment and immediate client claiming
 */

const CACHE_NAME = 'vibegrid-pwa-v53';
const OFFLINE_URL = '/offline.html';

const PRECACHE_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg'
];

// 0. Listen for SKIP_WAITING from client to activate immediately
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting')) {
    self.skipWaiting();
  }
});

// 1. Install Event: Cache Core App Shell & Skip Waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean Outdated Caches & Claim Clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event Routing
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // A. Do NOT intercept non-GET requests or WebSocket handshakes
  if (request.method !== 'GET' || url.pathname.startsWith('/socket.io/')) {
    return;
  }

  // B. STRICT SECURITY: Never cache sensitive, authenticated, or real-time endpoints
  // e.g. Auth sessions, End-to-End Encrypted chat messages, WebRTC signaling & calls
  const isPrivateApi = 
    url.pathname.startsWith('/api/auth') ||
    url.pathname.startsWith('/api/messages') ||
    url.pathname.startsWith('/api/calls') ||
    url.pathname.startsWith('/api/conversations') ||
    url.pathname.startsWith('/api/notifications');

  if (isPrivateApi) {
    return; // Pass through to network only
  }

  // C. Navigation Requests (HTML pages) -> Network-First with Offline Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            }).catch(() => {});
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline, check cache for navigation page or return offline.html
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const fallback = await caches.match(OFFLINE_URL);
          return fallback || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        })
    );
    return;
  }

  // D. Static Assets (Scripts, Styles, Fonts, Images) -> Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              }).catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      }).catch(() => {
        return fetch(request).catch(() => new Response('', { status: 408 }));
      })
    );
    return;
  }

  // E. Public Feeds & Discoveries -> Network-First with Cache Fallback
  if (
    url.pathname.startsWith('/api/feed') ||
    url.pathname.startsWith('/api/posts/feed') ||
    url.pathname.startsWith('/api/posts/explore') ||
    url.pathname.startsWith('/api/stories/active') ||
    url.pathname.startsWith('/api/hashtags/trending')
  ) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
});

// ============================================================================
// 4. Real Web Push Event: Display Native System / OS Notification
// ============================================================================
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[SW Push] Received push event with empty payload');
    return;
  }

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      title: 'VibeGrid',
      body: event.data.text()
    };
  }

  const notificationType = payload.data?.type || 'general';
  const isCall = notificationType === 'call';

  const title = payload.title || (isCall ? '📞 Incoming Call' : 'VibeGrid Notification');

  // Base options supported universally across Android, Desktop, and iOS Safari Web Push
  const baseOptions = {
    body: payload.body || (isCall ? 'Incoming call on VibeGrid...' : 'You have a new activity alert on VibeGrid.'),
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || (isCall ? `vg-call-${payload.data?.callId || Date.now()}` : `vg-${notificationType}-${Date.now()}`),
    data: payload.data || {},
    renotify: true
  };

  // Rich options with vibration, requireInteraction, and actions where supported
  const richOptions = {
    ...baseOptions,
    vibrate: isCall ? [300, 200, 300, 200, 500] : [200, 100, 200],
    requireInteraction: isCall
  };

  if (isCall && ('actions' in Notification.prototype)) {
    try {
      richOptions.actions = [
        { action: 'answer', title: '📞 Answer' },
        { action: 'decline', title: '✕ Decline' }
      ];
    } catch (e) {
      // Ignore if actions assignment fails
    }
  }

  // Attempt rich notification; fallback to baseOptions if rejected (e.g., iOS Safari or strict Android ROMs)
  event.waitUntil(
    self.registration.showNotification(title, richOptions).catch((err) => {
      console.warn('[SW Push] Rich notification failed, displaying base notification:', err?.message || err);
      return self.registration.showNotification(title, baseOptions).catch((fallbackErr) => {
        console.error('[SW Push] Base notification also failed:', fallbackErr?.message || fallbackErr);
      });
    })
  );
});

// ============================================================================
// 5. Notification Click Event: Deep Link Routing & Existing Window Focus
// ============================================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  const action = event.action;

  // If user tapped "Decline" on an incoming call action button
  if (action === 'decline') {
    return;
  }

  // Determine destination URL
  let targetUrl = notifData.url || '/';

  // Ensure target URL is absolute or properly formatted
  if (targetUrl.startsWith('/')) {
    targetUrl = self.location.origin + targetUrl;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. If an existing VibeGrid window is open, focus it and post navigation event
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.postMessage({
            type: 'NAVIGATE_FROM_NOTIFICATION',
            data: notifData
          });
          return client.focus().then(() => {
            if ('navigate' in client && targetUrl) {
              return client.navigate(targetUrl);
            }
          });
        }
      }

      // 2. Otherwise open a new window to the destination URL
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

