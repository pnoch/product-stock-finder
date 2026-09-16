import type { PriceAlert } from "../types";
import type { StorageContext } from "./context";

export function createAlertsStorage(ctx: StorageContext) {
  const { adapter, KEYS, notify, enqueue, readList } = ctx;

  // ─── Alerts ─────────────────────────────────────────────────────────────────

  async function getAlerts(): Promise<PriceAlert[]> {
    return readList<PriceAlert>(KEYS.ALERTS);
  }

  async function persistAlerts(alerts: PriceAlert[]): Promise<void> {
    await adapter.setItem(KEYS.ALERTS, JSON.stringify(alerts));
  }

  async function saveAlerts(alerts: PriceAlert[]): Promise<void> {
    await enqueue(KEYS.ALERTS, () => persistAlerts(alerts));
  }

  // Enqueued read-modify-write so concurrent callers never lose changes.
  async function updateAlerts(
    fn: (alerts: PriceAlert[]) => Promise<PriceAlert[]> | PriceAlert[],
  ): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const next = await fn(alerts);
      await persistAlerts(next);
    });
  }

  async function addAlert(alert: PriceAlert): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      alerts.unshift(alert);
      await persistAlerts(alerts);
      notify("alerts", alert.id);
    });
  }

  async function removeAlert(alertId: string): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      await persistAlerts(alerts.filter((a) => a.id !== alertId));
      notify("alerts", alertId);
    });
  }

  async function toggleAlert(alertId: string): Promise<void> {
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const updated = alerts.map((a) =>
        a.id === alertId ? { ...a, isActive: !a.isActive } : a,
      );
      await persistAlerts(updated);
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
      await persistAlerts(updated);
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
        next.isActive = true;
        next.triggeredAt = undefined;
        next.triggeredPrice = undefined;
        next.snoozedUntil = undefined;
        return next;
      });
      await persistAlerts(updated);
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
              snoozedUntil: undefined,
              // Re-stamp the activation time so a stale server event from the
              // previous trigger cannot immediately re-deactivate this alert.
              createdAt: new Date().toISOString(),
            }
          : a,
      );
      await persistAlerts(updated);
      notify("alerts", alertId);
    });
  }

  async function deactivateAlert(
    alertId: string,
    triggeredPrice: number,
    // Optional event time: a server event older than the alert's current
    // activation must not deactivate a freshly re-armed alert.
    eventAt?: number,
  ): Promise<boolean> {
    let transitioned = false;
    await enqueue(KEYS.ALERTS, async () => {
      const alerts = await getAlerts();
      const target = alerts.find((a) => a.id === alertId);
      // Compare-and-set: only the first runner to observe an untriggered
      // alert transitions it. Concurrent runners (foreground check vs
      // background task, separate isolates) see triggeredAt set and skip
      // their notification instead of double-firing.
      if (!target || target.triggeredAt) return;
      // Stale-event guard: if the alert was re-armed after this event fired,
      // ignore the event rather than immediately re-triggering it.
      if (eventAt != null && target.createdAt) {
        const activatedAt = Date.parse(target.createdAt);
        if (Number.isFinite(activatedAt) && eventAt < activatedAt) return;
      }
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
      await persistAlerts(updated);
      transitioned = true;
      notify("alerts", alertId);
    });
    return transitioned;
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
