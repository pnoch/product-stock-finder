// Import the leaf module, not the storage barrel: the barrel pulls in
// react-native/AsyncStorage, which the server bundle cannot load (the
// production server crashed on startup with a Flow syntax error).
import { DISTRIBUTOR_BREAKER_KEY, type StorageAdapter } from "../storage/adapter";

export interface BreakerEntry {
  distributorId: string;
  status: "working" | "blocked" | "error";
  consecutiveFailures: number;
  lastAttemptAt: number;
  cooldownUntil: number;
  reason?: string;
}

export interface BreakerStateStore {
  get(distributorId: string): Promise<BreakerEntry | null>;
  set(entry: BreakerEntry): Promise<void>;
  /** Clears a distributor's breaker so the next fetch is attempted again. */
  clear?(distributorId: string): Promise<void>;
}

export function createMemoryBreakerStore(): BreakerStateStore {
  const entries = new Map<string, BreakerEntry>();
  return {
    async get(distributorId) {
      return entries.get(distributorId) ?? null;
    },
    async set(entry) {
      entries.set(entry.distributorId, entry);
    },
    async clear(distributorId) {
      entries.delete(distributorId);
    },
  };
}

// Read-modify-write serialization for the persisted breaker list. The queue is
// module-level (keyed by storage key) because the app creates several breaker
// stores over the same `distributor_breaker` key (health probes, background
// refresh, price-source); a per-instance queue would let concurrent writers
// from different instances clobber each other's entries.
const breakerQueues = new Map<string, Promise<unknown>>();

function serializeByKey<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = breakerQueues.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  breakerQueues.set(key, next.catch(() => {}));
  return next;
}

export function createStorageBreakerStore(
  adapter: Pick<StorageAdapter, "getItem" | "setItem">,
): BreakerStateStore {
  async function readList(): Promise<BreakerEntry[]> {
    try {
      const raw = await adapter.getItem(DISTRIBUTOR_BREAKER_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Drop malformed entries: a null/non-object entry would make
      // `list.find((e) => e.distributorId === id)` throw, and resilientFetch
      // does not catch that, so the whole scrape would reject.
      return parsed.filter(
        (e): e is BreakerEntry =>
          !!e &&
          typeof e === "object" &&
          typeof (e as BreakerEntry).distributorId === "string",
      );
    } catch {
      return [];
    }
  }

  return {
    get(distributorId) {
      return serializeByKey(DISTRIBUTOR_BREAKER_KEY, async () => {
        const list = await readList();
        return list.find((e) => e.distributorId === distributorId) ?? null;
      });
    },
    set(entry) {
      return serializeByKey(DISTRIBUTOR_BREAKER_KEY, async () => {
        try {
          const list = await readList();
          const next = list.filter((e) => e.distributorId !== entry.distributorId);
          next.push(entry);
          await adapter.setItem(DISTRIBUTOR_BREAKER_KEY, JSON.stringify(next));
        } catch {
          // Ignore persistence errors
        }
      });
    },
    clear(distributorId) {
      return serializeByKey(DISTRIBUTOR_BREAKER_KEY, async () => {
        try {
          const list = await readList();
          const next = list.filter((e) => e.distributorId !== distributorId);
          await adapter.setItem(DISTRIBUTOR_BREAKER_KEY, JSON.stringify(next));
        } catch {
          // Ignore persistence errors
        }
      });
    },
  };
}
