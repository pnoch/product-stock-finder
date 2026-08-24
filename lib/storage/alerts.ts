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
    addAlert,
    removeAlert,
    toggleAlert,
    snoozeAlert,
    rearmAlert,
    deactivateAlert,
  };
}
