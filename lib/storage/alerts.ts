import type { PriceAlert } from "../types";
import type { StorageContext } from "./context";

export function createAlertsStorage(ctx: StorageContext) {
  const { adapter, KEYS, notify, enqueue, readList } = ctx;

  // ─── Alerts ─────────────────────────────────────────────────────────────────

  async function getAlerts(): Promise<PriceAlert[]> {
    return readList<PriceAlert>(KEYS.ALERTS);
  }

  async function saveAlerts(alerts: PriceAlert[]): Promise<void> {
    await adapter.setItem(KEYS.ALERTS, JSON.stringify(alerts));
  }

  // Enqueued read-modify-write so concurrent callers never lose changes.
  async function updateAlerts(
    fn: (alerts: PriceAlert[]) => Promise<PriceAlert[]> | PriceAlert[],
  ): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const next = await fn(alerts);
      await saveAlerts(next);
    });
  }

  async function addAlert(alert: PriceAlert): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      alerts.unshift(alert);
      await saveAlerts(alerts);
      notify("alerts", alert.id);
    });
  }

  async function removeAlert(alertId: string): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      await saveAlerts(alerts.filter((a) => a.id !== alertId));
      notify("alerts", alertId);
    });
  }

  async function toggleAlert(alertId: string): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const updated = alerts.map((a) =>
        a.id === alertId ? { ...a, isActive: !a.isActive } : a,
      );
      await saveAlerts(updated);
      notify("alerts", alertId);
    });
  }

  async function snoozeAlert(alertId: string, days: number): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const updated = alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              snoozedUntil:
                days > 0
                  ? new Date(Date.now() + days * 86400000).toISOString()
                  : undefined,
            }
          : a,
      );
      await saveAlerts(updated);
      notify("alerts", alertId);
    });
  }

  async function updateAlert(
    alertId: string,
    patch: {
      targetPrice?: number;
      currency?: string;
      direction?: "drop" | "rise";
      distributorId?: string | null;
    },
  ): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const updated = alerts.map((a) => {
        if (a.id !== alertId) return a;
        const next: PriceAlert = { ...a };
        if (patch.targetPrice !== undefined)
          next.targetPrice = patch.targetPrice;
        if (patch.currency !== undefined) next.currency = patch.currency;
        if (patch.direction !== undefined) next.direction = patch.direction;
        if (patch.distributorId !== undefined)
          next.distributorId = patch.distributorId ?? undefined;
        // Field changes re-arm the alert and clear stale trigger info
        next.triggeredAt = undefined;
        next.triggeredPrice = undefined;
        return next;
      });
      await saveAlerts(updated);
      notify("alerts", alertId);
    });
  }

  async function rearmAlert(alertId: string): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const updated = alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              isActive: true,
              triggeredAt: undefined,
              triggeredPrice: undefined,
            }
          : a,
      );
      await saveAlerts(updated);
      notify("alerts", alertId);
    });
  }

  async function deactivateAlert(
    alertId: string,
    triggeredPrice: number,
  ): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const updated = alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              isActive: false,
              triggeredAt: new Date().toISOString(),
              triggeredPrice,
            }
          : a,
      );
      await saveAlerts(updated);
      notify("alerts", alertId);
    });
  }

  return {
    getAlerts,
    saveAlerts,
    updateAlerts,
    addAlert,
    removeAlert,
    toggleAlert,
    snoozeAlert,
    updateAlert,
    rearmAlert,
    deactivateAlert,
  };
}
