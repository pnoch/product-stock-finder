import { createStorageBreakerStore } from "./resilient";
import { getDefaultAdapter } from "../storage";

// Clears a distributor's circuit-breaker entry so the next fetch is attempted
// again. Used by the Settings "Re-enable" action, which previously only
// refreshed `lastChecked` and left the distributor in cooldown.
export async function clearDistributorBreaker(
  distributorId: string,
): Promise<void> {
  const store = createStorageBreakerStore(getDefaultAdapter());
  await store.clear?.(distributorId);
}
