export function routeForNotification(data: { productId?: string; type?: string }): string {
  if (data.productId) return `/product/${data.productId}`;
  if (data.type === "digest") return "/stats";
  if (data.type?.startsWith("health")) return "/health";
  return "/";
}

interface RoutableRef {
  id: string;
  productId: string;
}

export function resolveEventRoute(
  event: {
    type?: string;
    productId?: string;
    alertId?: string;
    watchId?: string;
    reminderId?: string;
  },
  alerts: RoutableRef[],
  watches: RoutableRef[],
  reminders: RoutableRef[],
): string {
  if (event.alertId) {
    const productId = alerts.find((a) => a.id === event.alertId)?.productId;
    if (productId) return `/product/${productId}`;
  }
  if (event.watchId) {
    const productId = watches.find((w) => w.id === event.watchId)?.productId;
    if (productId) return `/product/${productId}`;
  }
  if (event.reminderId) {
    const productId = reminders.find((r) => r.id === event.reminderId)?.productId;
    if (productId) return `/product/${productId}`;
  }
  return routeForNotification({ productId: event.productId, type: event.type });
}
