import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export async function startPricePoller(
  intervalMinutes: number = 15,
  apiBaseUrl: string = "",
): Promise<void> {
  try {
    await invoke("start_price_poller", { intervalMinutes, apiBaseUrl });
  } catch (e) {
    console.error("Failed to start price poller:", e);
    throw e;
  }
}

export async function stopPricePoller(): Promise<void> {
  try {
    await invoke("stop_price_poller");
  } catch (e) {
    console.error("Failed to stop price poller:", e);
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
  return listen("listing-updated", (event) => {
    callback(event.payload as any);
  });
}

export function onPricesChecked(
  callback: (results: any[]) => void,
): Promise<UnlistenFn> {
  return listen("prices-checked", (event) => {
    callback(event.payload as any);
  });
}

// Emitted by Rust after check_price_drops (desktop/src-tauri/src/lib.rs);
// App.tsx records each trigger via storage.recordNotificationEvent.
export function onPriceDropsTriggered(
  callback: (events: Array<{ alertId: string; productId: string; productName: string; bestPrice: number; currency: string; targetPrice: number }>) => void,
): Promise<UnlistenFn> {
  return listen("price-drops-triggered", (event) => {
    callback(event.payload as any);
  });
}
