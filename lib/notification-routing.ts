export function notificationRouteFor(data: { productId?: string; type?: string }): `/product/${string}` | "/stats" | "/health" | null {
  if (data.productId) return `/product/${data.productId}`;
  if (data.type === "digest") return "/stats";
  if (data.type?.startsWith("health")) return "/health";
  return null;
}
