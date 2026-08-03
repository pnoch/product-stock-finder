import { invoke } from "@tauri-apps/api/core";

export async function startPricePoller(
  intervalMinutes: number = 15,
): Promise<void> {
  try {
    await invoke("start_price_poller", { intervalMinutes });
  } catch (e) {
    console.error("Failed to start price poller:", e);
  }
}

export async function checkPriceDropsNow(): Promise<string> {
  try {
    return await invoke("check_price_drops");
  } catch (e) {
    return `Error: ${e}`;
  }
}

export async function stopPricePoller(): Promise<void> {
  try {
    await invoke("stop_price_poller");
  } catch (e) {
    console.error("Failed to stop price poller:", e);
  }
}
