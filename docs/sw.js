const CACHE = "resum-v1";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.endsWith("data.json")) e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  else e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
self.addEventListener("push", (e) => {
  let d = { title: "📈 Nou resum econòmic", body: "Ja tens el resum d'aquesta setmana." };
  try { if (e.data) d = { ...d, ...e.data.json() }; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, icon: "./icon-192.png", badge: "./icon-192.png" }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow("./"));
});
