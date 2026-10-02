import type { PriceAlert } from "./types";

// Two distinct user-visible metrics:
// - "armed" (`isAlertActive`): enabled, untriggered, not currently snoozed —
//   the Home "Active Alerts" stat.
// - "open" (`countOpenAlerts`): every untriggered alert the Alerts tab renders
//   as a card (armed + snoozed + paused). The Alerts tab badge/segment uses
//   this so the count matches the cards shown.
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

/** Every untriggered alert the Alerts tab lists as a card (armed + snoozed + paused). */
export function countOpenAlerts(alerts: PriceAlert[]): number {
  return alerts.filter((a) => !a.triggeredAt).length;
}
