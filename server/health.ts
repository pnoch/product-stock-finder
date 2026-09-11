import { createHealthService } from "../lib/scrapers/health";
import type { StorageAdapter } from "../lib/storage/adapter";

// Stateless by design: a fresh adapter per call means breaker state and
// history never persist server-side. The client persists results through its
// own health service (desktop Health page, mobile probe task).
function memoryAdapter(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    async getItem(key) { return store.get(key) ?? null; },
    async setItem(key, value) { store.set(key, value); },
    async removeItem(key) { store.delete(key); },
    async multiRemove(keys) { keys.forEach((k) => store.delete(k)); },
  };
}

export async function checkAllDistributors() {
  const svc = createHealthService(memoryAdapter());
  return svc.testAllDistributors();
}
