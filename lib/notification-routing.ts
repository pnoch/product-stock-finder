export function notificationRouteFor(
  // Notifications are not guaranteed to carry a data payload.
  data:
    | { productId?: string; distributorId?: string; type?: string }
    | undefined
    | null,
): `/product/${string}` | "/stats" | "/health" | null {
  if (!data) return null;
  if (data.productId) {
    // A restock alert carries the in-stock store; open the product with that
    // store highlighted so the tap lands on the next action, not a bare detail.
    return data.distributorId
      ? `/product/${data.productId}?distributor=${data.distributorId}`
      : `/product/${data.productId}`;
  }
  if (data.type === "digest") return "/stats";
  if (data.type?.startsWith("health")) return "/health";
  return null;
}
