const PRECACHE = "precache-v2";
const PRECACHE_URLS = [
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/icon.png",
  "/_expo/static/css/web-87e95864ffb2718b1cab3ff1f7024173.css",
  "/_expo/static/js/web/entry-7673a05199f6e25f632037042d29ff5e.js",
  "/_expo/static/js/web/browser-1e07bb39cc5332992419e7870e864636.js",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("[sw] precache addAll failed", err);
      }),
    ).then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== PRECACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Navigation requests: network-first, fallback to cached index.html (SPA fallback)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Optionally cache successful navigations
          const clone = response.clone();
          caches.open(PRECACHE).then((cache) => cache.put(event.request, clone)).catch(() => {});
          return response;
        })
        .catch(() => caches.match("/index.html").then((cached) => cached ?? caches.match(event.request))),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.url.includes("/_expo/static/")) {
            const clone = response.clone();
            caches.open(PRECACHE).then((cache) => cache.put(event.request, clone)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached ?? Promise.reject(new Error("offline and not cached")));
    }),
  );
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
