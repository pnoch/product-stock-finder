export function notificationRouteFor(
  // Notifications are not guaranteed to carry a data payload.
  data: { productId?: string; type?: string } | undefined | null,
): `/product/${string}` | "/stats" | "/health" | null {
  if (!data) return null;
  if (data.productId) return `/product/${data.productId}`;
  if (data.type === "digest") return "/stats";
  if (data.type?.startsWith("health")) return "/health";
  return null;
}
