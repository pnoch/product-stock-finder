import type { NotificationConfig } from "./types";

export function aggregateConfigs(configs: NotificationConfig[]): NotificationConfig {
  const alerts = new Map<string, NotificationConfig["alerts"][number]>();
  const stockWatches = new Map<string, NotificationConfig["stockWatches"][number]>();
  const dateReminders = new Map<string, NotificationConfig["dateReminders"][number]>();
  for (const config of configs) {
    for (const alert of config.alerts) {
      if (!alerts.has(alert.id)) alerts.set(alert.id, alert);
    }
    for (const watch of config.stockWatches) {
      if (!stockWatches.has(watch.id)) stockWatches.set(watch.id, watch);
    }
    for (const reminder of config.dateReminders) {
      if (!dateReminders.has(reminder.id)) dateReminders.set(reminder.id, reminder);
    }
  }
  // Carry quiet hours through aggregation: the digest day bucket needs the
  // user's UTC offset, and dropping it made the timezone fix a no-op for
  // signed-in users (the main path).
  const quietHours = configs.find((c) => c.quietHours)?.quietHours;
  return {
    alerts: [...alerts.values()],
    stockWatches: [...stockWatches.values()],
    dateReminders: [...dateReminders.values()],
    ...(quietHours ? { quietHours } : {}),
  };
}
