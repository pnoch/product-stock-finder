self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // malformed payloads are ignored
  }
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