import { useCallback, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import * as TaskManager from "expo-task-manager";
import { getSettings, getLastBackgroundRun } from "@/lib/storage";
import { getEntitlementState } from "@/lib/entitlements";
import { shouldEnforceFreeLimits } from "@/lib/pro-features";
import { PRICE_CHECK_TASK } from "@/lib/background-tasks/tasks";
import { assessMonitoringHealth, type MonitoringHealth } from "@/lib/monitoring-health";

const OFF: MonitoringHealth = { status: "off" };

export function useMonitoringHealth(): MonitoringHealth {
  const [health, setHealth] = useState<MonitoringHealth>(OFF);

  const assess = useCallback(async () => {
    if (Platform.OS === "web") {
      setHealth(OFF);
      return;
    }
    try {
      const settings = await getSettings();
      const { isPro } = await getEntitlementState();
      const enabled =
        !!settings.backgroundServiceEnabled &&
        (!shouldEnforceFreeLimits() || isPro) &&
        settings.checkInterval !== "manual";
      let registered = false;
      try {
        registered = await TaskManager.isTaskRegisteredAsync(PRICE_CHECK_TASK);
      } catch {
        registered = false;
      }
      const lastRunAt = await getLastBackgroundRun();
      const intervalMs = (settings.checkInterval === "hourly" ? 60 : 1440) * 60_000;
      setHealth(
        assessMonitoringHealth({ enabled, registered, lastRunAt, intervalMs, now: Date.now() }),
      );
    } catch {
      setHealth(OFF);
    }
  }, []);

  useEffect(() => {
    void assess();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void assess();
    });
    return () => sub.remove();
  }, [assess]);

  return health;
}
