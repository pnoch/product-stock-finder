import type { PriceAlert } from "./types";

// A price alert that is currently armed: enabled, not yet triggered, and not
// snoozed (or its snooze has elapsed). Every user-visible "active alerts" count
// must use this, or the Home stat card, the Alerts tab badge, and the tab
// counter disagree (they previously used three different predicates).
export function isAlertActive(
  alert: Pick<PriceAlert, "isActive" | "triggeredAt" | "snoozedUntil">,
  now: number = Date.now(),
): boolean {
  if (!alert.isActive || alert.triggeredAt) return false;
  if (alert.snoozedUntil) {
    const until = Date.parse(alert.snoozedUntil);
    if (Number.isFinite(until) && until > now) return false;
  }
  return true;
}

export function countActiveAlerts(
  alerts: PriceAlert[],
  now: number = Date.now(),
): number {
  return alerts.filter((a) => isAlertActive(a, now)).length;
}
