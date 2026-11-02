// Offline support. The whole guide is saved on the device after the first visit.
// A new version is downloaded quietly and only takes over when the reader taps "Refresh".
const CACHE = 'aisa-__BUILD__';
const ASSETS = __ASSETS__;
const scope = self.registration.scope;
const abs = (u) => new URL(u, scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) =>
    // cache: 'reload' skips the browser's own copy so a fresh page is never stored stale
    Promise.all(ASSETS.map((u) => cache.add(new Request(abs(u), { cache: 'reload' }))))));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('aisa-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Pages: ask the network first (so updates appear at once), fall back to the saved copy,
// and finally to the branded offline page.
function networkFirst(req) {
  return new Promise((resolve) => {
    let settled = false;
    const fromCache = () => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match(abs('offline.html')));
    const timer = setTimeout(() => { if (!settled) fromCache().then((r) => { if (r && !settled) { settled = true; resolve(r); } }); }, 4000);
    fetch(req).then((res) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      resolve(res);
    }).catch(() => { clearTimeout(timer); if (!settled) { settled = true; fromCache().then(resolve); } });
  });
}

// Search data: show what is saved, refresh it in the background.
function staleWhileRevalidate(req) {
  return caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }).catch(() => hit);
    return hit || net;
  });
}

// Fonts, styles, scripts, icons: saved copy first.
function cacheFirst(req) {
  return caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') { event.respondWith(networkFirst(req)); return; }
  if (/\/(search-index|steps)\.json$/.test(url.pathname)) { event.respondWith(staleWhileRevalidate(req)); return; }
  event.respondWith(cacheFirst(req));
});
