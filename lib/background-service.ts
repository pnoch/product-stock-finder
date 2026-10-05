import { log } from "@shared/log";
import {
  startForegroundService,
  stopForegroundService,
  isForegroundServiceRunning,
} from "@/modules/psf-foreground-service";

// Thin, Android-guarded wrapper. The native module no-ops off Android, so these
// are safe everywhere; failures are logged, never thrown.
export async function enableBackgroundService(): Promise<void> {
  try {
    await startForegroundService();
  } catch (e) {
    log.warn("[BackgroundService] start failed", e);
  }
}

export async function disableBackgroundService(): Promise<void> {
  try {
    await stopForegroundService();
  } catch (e) {
    log.warn("[BackgroundService] stop failed", e);
  }
}

export async function isBackgroundServiceEnabled(): Promise<boolean> {
  try {
    return await isForegroundServiceRunning();
  } catch {
    return false;
  }
}
