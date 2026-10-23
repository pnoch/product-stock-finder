// Once an event has been delivered everywhere its dedup key would otherwise
// be released, and a persisting condition (price still below target, past-due
// reminder) would re-fire on every warmer tick. Keep the key blocked for a
// cooldown window after creation; legitimate re-fires (e.g. a second restock)
// resume afterwards.
export const EVENT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// An event also stays blocked until every bound device has pulled it, so a
// device that binds later still catches up. That wait must be bounded: a stale
// or abandoned device binding would otherwise suppress the same condition
// forever (its delivery count never reaches the bound count).
export const DELIVERY_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function isEventBlocking(
  createdAt: number,
  deliveredCount: number,
  boundCount: number,
  now: number,
): boolean {
  if (now - createdAt < EVENT_COOLDOWN_MS) return true;
  return deliveredCount < boundCount && now - createdAt < DELIVERY_GRACE_MS;
}
