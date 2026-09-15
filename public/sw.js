const PRECACHE = "precache-v3";
// Stable URLs only. Hashed /_expo/static/* bundles change on every `expo export`
// and would break cache.addAll (it rejects if any URL 404s), so they are served
// by the runtime cache-first handler below instead of being precached here.
const PRECACHE_URLS = [
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
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
  const data = event.notification.data || {};
  // Deep-link to the product when the payload carries one; digest/health fall
  // back to their own routes. Without this every push opened Home.
  let route = "/";
  if (data.productId) route = `/product/${data.productId}`;
  else if (data.type === "digest") route = "/stats";
  else if (typeof data.type === "string" && data.type.startsWith("health"))
    route = "/health";
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client && route !== "/") {
            try {
              await client.navigate(route);
            } catch {
              // navigation is best-effort
            }
          }
          return;
        }
      }
      await self.clients.openWindow(route);
    })(),
  );
});
