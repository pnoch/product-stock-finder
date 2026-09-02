const PRECACHE = "precache-v1";
const PRECACHE_URLS = ["/index.html", "/manifest.json"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== PRECACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
});
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // malformed payloads are ignored
  }
  if (!data || typeof data !== "object") data = {};
  const { title = "Product Stock Finder", body = "", eventId = null } = data;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const focused = clients.some((client) => client.focused);
      if (focused) return;
      await self.registration.showNotification(title, {
        body,
        data: { eventId },
      });
      for (const client of clients) {
        client.postMessage({ type: "web-push-shown", eventId });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          return;
        }
      }
      await self.clients.openWindow("/");
    })(),
  );
});
