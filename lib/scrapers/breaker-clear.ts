import { createStorageBreakerStore } from "./resilient";
import { getDefaultAdapter } from "../storage";
import type { StorageAdapter } from "../storage/adapter";

// Clears a distributor's circuit-breaker entry so the next fetch is attempted
// again. Used by the Settings "Re-enable" action, which previously only
// refreshed `lastChecked` and left the distributor in cooldown.
//
// The adapter must be the one the caller's health/fetch path writes the breaker
// with: desktop's probe uses a localStorage adapter, but getDefaultAdapter()
// resolves to IndexedDB in a Tauri webview, so clearing without passing it left
// the real breaker intact.
export async function clearDistributorBreaker(
  distributorId: string,
  adapter?: Pick<StorageAdapter, "getItem" | "setItem">,
): Promise<void> {
  const store = createStorageBreakerStore(adapter ?? getDefaultAdapter());
  await store.clear?.(distributorId);
}
