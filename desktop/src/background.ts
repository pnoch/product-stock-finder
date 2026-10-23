import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { log } from "@shared/log";

export async function startPricePoller(
  intervalMinutes: number = 15,
  apiBaseUrl: string = "",
): Promise<void> {
  try {
    await invoke("start_price_poller", { intervalMinutes, apiBaseUrl });
  } catch (e) {
    log.error("Failed to start price poller:", e);
    throw e;
  }
}

export async function stopPricePoller(): Promise<void> {
  try {
    await invoke("stop_price_poller");
  } catch (e) {
    log.error("Failed to stop price poller:", e);
  }
}

export function onListingUpdated(
  callback: (listing: {
    productId: string;
    distributorId: string;
    price: number;
    currency: string;
    stockStatus: string;
    expectedDate?: string;
    lastChecked: string;
  }) => void,
): Promise<UnlistenFn> {
  return listen<Parameters<typeof callback>[0]>("listing-updated", (event) => {
    callback(event.payload);
  });
}

export function onPricesChecked(
  callback: (results: unknown[]) => void,
): Promise<UnlistenFn> {
  return listen<unknown[]>("prices-checked", (event) => {
    callback(event.payload);
  });
}

// Emitted by Rust after check_price_drops (desktop/src-tauri/src/lib.rs);
// App.tsx records each trigger via storage.recordNotificationEvent.
export function onPriceDropsTriggered(
  callback: (events: { alertId: string; productId: string; productName: string; bestPrice: number; currency: string; targetPrice: number; isRise?: boolean }[]) => void,
): Promise<UnlistenFn> {
  return listen<Parameters<typeof callback>[0]>("price-drops-triggered", (event) => {
    callback(event.payload);
  });
}
