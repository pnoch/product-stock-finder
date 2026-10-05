import { enableBackgroundService, disableBackgroundService } from "./background-service";

// Keeps the native side in sync with the persisted toggle value.
export async function applyBackgroundServiceToggle(enabled: boolean): Promise<void> {
  if (enabled) await enableBackgroundService();
  else await disableBackgroundService();
}
