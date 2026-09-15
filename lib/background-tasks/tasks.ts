import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { Platform } from "react-native";
import { getSettings, getBackgroundTaskInterval, saveBackgroundTaskInterval } from "../storage";
import { healthService } from "./instances";
import { checkHealthAlerts } from "./health-alerts";
import { runPriceCheckCore } from "./price-check";

export const PRICE_CHECK_TASK = "price-drop-check";
export const HEALTH_PROBE_TASK = "health-probe";

// Must be defined in global scope, outside any component
TaskManager.defineTask(PRICE_CHECK_TASK, async () => {
  try {
    await runPriceCheckCore();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

TaskManager.defineTask(HEALTH_PROBE_TASK, async () => {
  try {
    await healthService.testAllDistributors();
    await checkHealthAlerts();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerPriceCheckTask() {
  if (Platform.OS === "web") return;
  try {
    const settings = await getSettings();
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(PRICE_CHECK_TASK);

    if (settings.checkInterval === "manual") {
      // Manual mode — unregister if previously registered
      if (isRegistered) {
        await BackgroundTask.unregisterTaskAsync(PRICE_CHECK_TASK);
      }
      await saveBackgroundTaskInterval(null);
      return;
    }

    const intervalMinutes = settings.checkInterval === "hourly" ? 60 : 1440;
    const lastInterval = await getBackgroundTaskInterval();

    // Only (re)register when the task is missing or the interval changed.
    // Re-registering on every launch resets the OS scheduling window (iOS) and
    // can defer the task indefinitely.
    if (isRegistered && lastInterval === intervalMinutes) return;

    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(PRICE_CHECK_TASK);
    }
    await BackgroundTask.registerTaskAsync(PRICE_CHECK_TASK, {
      minimumInterval: intervalMinutes,
    });
    await saveBackgroundTaskInterval(intervalMinutes);
  } catch {
    // Background tasks not available on simulator/web — silently ignore
  }
}

export async function registerHealthProbeTask() {
  if (Platform.OS === "web") return;
  try {
    const settings = await getSettings();
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(HEALTH_PROBE_TASK);

    if (settings.checkInterval === "manual") {
      if (isRegistered) {
        await BackgroundTask.unregisterTaskAsync(HEALTH_PROBE_TASK);
      }
      return;
    }

    const intervalMinutes = settings.checkInterval === "hourly" ? 60 : 1440;
    // Shares the interval marker with the price task: both use the same
    // setting, so one marker is sufficient and avoids a second key.
    const lastInterval = await getBackgroundTaskInterval();

    if (isRegistered && lastInterval === intervalMinutes) return;

    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(HEALTH_PROBE_TASK);
    }
    await BackgroundTask.registerTaskAsync(HEALTH_PROBE_TASK, {
      minimumInterval: intervalMinutes,
    });
    await saveBackgroundTaskInterval(intervalMinutes);
  } catch {
    // Background tasks not available on simulator/web — silently ignore
  }
}

export async function syncBackgroundTasks() {
  await registerPriceCheckTask();
  await registerHealthProbeTask();
}
