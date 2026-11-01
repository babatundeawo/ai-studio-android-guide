// Offline support: the guide is cached after the first visit so it can be read without a connection.
const CACHE = 'aisa-__BUILD__';
const CORE = __CORE__;     // must be cached for the app to work offline
const ASSETS = __ASSETS__; // cached on a best-effort basis

self.addEventListener('install', (event) => {
  // No skipWaiting here: a new version waits until the reader taps "Refresh", so a page is never swapped mid-read.
  event.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(CORE);
    await Promise.allSettled(ASSETS.map((a) => c.add(a)));
  }));
});

self.addEventListener('message', (event) => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('aisa-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const store = (req, res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };

// Pages: network first, so updates appear immediately. If the network is slow (4 s) or gone, use the saved copy.
function pageRequest(req) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => { if (!settled && r) { settled = true; resolve(r); } };
    const fallback = () => caches.match(req).then((hit) => hit || caches.match('offline.html'));
    const timer = setTimeout(() => caches.match(req).then(done), 4000);
    fetch(req).then((res) => { clearTimeout(timer); done(store(req, res)); })
      .catch(() => { clearTimeout(timer); fallback().then(done); });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') { event.respondWith(pageRequest(req)); return; }
  // Everything else: saved copy first, refreshed in the background.
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => store(req, res)).catch(() => hit);
      return hit || net;
    })
  );
});
