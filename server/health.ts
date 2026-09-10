import { createHealthService } from "../lib/scrapers/health";
import type { StorageAdapter } from "../lib/storage/adapter";

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
