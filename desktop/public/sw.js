self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // malformed payloads are ignored
  }
  if (!data || typeof data !== "object") data = {};
  const {
    title = "Product Stock Finder",
    body = "",
    eventId = null,
    type,
    productId,
  } = data;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const focused = clients.some((client) => client.focused);
      if (focused) return;
      // Carry the server's routing fields: notificationclick reads them to
      // deep-link, and only `eventId` made every push open the app root.
      await self.registration.showNotification(title, {
        body,
        data: { eventId, type, productId },
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
  // back to their own routes. Mirrors public/sw.js — without this every push
  // opened the app root.
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
