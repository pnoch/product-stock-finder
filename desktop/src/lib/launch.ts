import type { Storage } from "../../../lib/storage";
import { log } from "@shared/log";

export interface LaunchDeps {
  storage: Storage;
  startPoller: (intervalMinutes: number, apiBaseUrl: string) => Promise<void>;
  getApiBaseUrl: () => string;
  loadFx: (storage: Storage) => Promise<void>;
  maybeRefreshFx: (storage: Storage) => Promise<void>;
  /**
   * One foreground price check (scrape → persist → alerts → tray). Mirrors the
   * mobile's `checkPriceDropsNow()` on launch: with the default "manual"
   * interval the poller never runs, so without this the desktop evaluated
   * price alerts, restock watches and the digest only after a manual refresh.
   */
  checkPricesOnce: () => Promise<void>;
}

export async function runLaunchSequence(deps: LaunchDeps): Promise<void> {
  const {
    storage,
    startPoller,
    getApiBaseUrl,
    loadFx,
    maybeRefreshFx,
    checkPricesOnce,
  } = deps;

  try {
    const settings = await storage.getSettings();
    if (settings?.checkInterval && settings.checkInterval !== "manual") {
      const minutes = settings.checkInterval === "hourly" ? 60 : 1440;
      try {
        await startPoller(minutes, getApiBaseUrl());
      } catch (e) {
        log.error("[App] launch poller start failed", e);
      }
    }
  } catch (e) {
    log.error("[App] launch poller start failed", e);
  }

  try {
    await loadFx(storage);
    await maybeRefreshFx(storage);
  } catch (e) {
    log.error("[App] fx warm failed", e);
  }

  // After the FX overlay is warm so the check converts with live rates.
  try {
    await checkPricesOnce();
  } catch (e) {
    log.error("[App] launch price check failed", e);
  }
}
