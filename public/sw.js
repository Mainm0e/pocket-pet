// Minimal offline cache: network-first for pages, cache-first for hashed assets.
// Also shows reminders ("Your pet is hungry!") that the app left in a small cache (src/lib/reminders.js).
const CACHE = 'pocket-pet-v4';
const REMINDERS = 'pocket-pet-reminders';
const REMINDERS_KEY = '/__reminders.json';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon.svg'])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== REMINDERS).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('/', res.clone()));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
    )
  );
});

// ---- reminders ----
/**
 * Show every reminder that is due and hasn't been shown yet. Returns the titles.
 * `dry`: only say what would be shown (tests; headless browsers can't show notifications).
 */
async function checkReminders(now = Date.now(), dry = false) {
  const c = await caches.open(REMINDERS);
  const res = await c.match(REMINDERS_KEY);
  if (!res) return [];
  const data = await res.json();
  const due = data.items.filter((it) => it.at <= now && !data.shown.includes(it.id));
  if (dry) return due.map((it) => it.title);
  for (const it of due) {
    await self.registration.showNotification(it.title, { body: it.body, tag: it.kind, icon: '/icon.svg', badge: '/icon.svg', data: { url: '/' } });
    data.shown.push(it.id);
  }
  data.shown = data.shown.slice(-50);
  await c.put(REMINDERS_KEY, new Response(JSON.stringify(data)));
  return due.map((it) => it.title);
}
// Chrome wakes an installed app now and then (it decides how often)
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'pet-check') e.waitUntil(checkReminders());
});
// the page asks while it's still alive in the background (and tests ask with a pretend time)
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'check-reminders') return;
  e.waitUntil(checkReminders(e.data.now, e.data.dry).then((titles) => e.source?.postMessage({ type: 'reminders-checked', titles })));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => 'focus' in c);
      return open ? open.focus() : self.clients.openWindow(e.notification.data?.url ?? '/');
    })
  );
});
