import type { Product, Distributor } from "../types";
import type { StorageContext } from "./context";

// Discovery results are persisted to AsyncStorage with no UI to prune them, so
// bound the arrays (keep the newest) like every other stored collection.
const MAX_DISCOVERED_PRODUCTS = 200;
const MAX_DISCOVERED_DISTRIBUTORS = 200;

export function createDiscoveryStorage(ctx: StorageContext) {
  const { adapter, KEYS, enqueue, readList } = ctx;

  // ─── Discovered Products ────────────────────────────────────────────────────

  async function getDiscoveredProducts(): Promise<Product[]> {
    return readList<Product>(KEYS.DISCOVERED_PRODUCTS);
  }

  async function persistDiscoveredProducts(products: Product[]): Promise<void> {
    await adapter.setItem(KEYS.DISCOVERED_PRODUCTS, JSON.stringify(products));
  }

  async function saveDiscoveredProducts(products: Product[]): Promise<void> {
    await enqueue(KEYS.DISCOVERED_PRODUCTS, () =>
      persistDiscoveredProducts(products),
    );
  }

  // The server mints `discovered-<Date.now()>`, so the id differs on every
  // discovery of the same product: deduping on it appended duplicates and, at
  // the cap, evicted genuinely distinct entries.
  function productIdentity(p: Product): string | null {
    const model = (p.modelNumber ?? "").trim().toLowerCase();
    if (!model) return null;
    return `${(p.brand ?? "").trim().toLowerCase()}|${model}`;
  }

  // Returns the canonical stored product. The server mints a fresh
  // `discovered-<timestamp>` id on every discovery, so a re-discovery of the
  // same product must return the EXISTING id — otherwise the caller adds a
  // second watchlist entry for a product it already tracks (the watchlist
  // dedups by id, not by model).
  async function addDiscoveredProduct(product: Product): Promise<Product> {
    return enqueue(KEYS.DISCOVERED_PRODUCTS, async () => {
      const existing = await getDiscoveredProducts();
      const sameId = existing.find((p) => p.id === product.id);
      if (sameId) return sameId;
      const identity = productIdentity(product);
      const idx = identity
        ? existing.findIndex((p) => productIdentity(p) === identity)
        : -1;
      if (idx >= 0) {
        // Same product: refresh in place, keeping the original id so existing
        // links keep working.
        const canonical = { ...product, id: existing[idx]!.id };
        const next = [...existing];
        next[idx] = canonical;
        await persistDiscoveredProducts(next);
        return canonical;
      }
      const next = [...existing, product];
      await persistDiscoveredProducts(
        next.length > MAX_DISCOVERED_PRODUCTS
          ? next.slice(next.length - MAX_DISCOVERED_PRODUCTS)
          : next,
      );
      return product;
    });
  }

  // ─── Discovered Distributors ────────────────────────────────────────────────

  async function getDiscoveredDistributors(): Promise<Distributor[]> {
    const stored = await readList<Distributor>(KEYS.DISCOVERED_DISTRIBUTORS);
    // Rows persisted before taxMode became required have it absent; default
    // here so a legacy row never surfaces as undefined.
    return stored.map((d) => ({ ...d, taxMode: d.taxMode ?? "origin" }));
  }

  async function persistDiscoveredDistributors(
    distributors: Distributor[],
  ): Promise<void> {
    await adapter.setItem(
      KEYS.DISCOVERED_DISTRIBUTORS,
      JSON.stringify(distributors),
    );
  }

  async function saveDiscoveredDistributors(
    distributors: Distributor[],
  ): Promise<void> {
    await enqueue(KEYS.DISCOVERED_DISTRIBUTORS, () =>
      persistDiscoveredDistributors(distributors),
    );
  }

  async function addDiscoveredDistributor(
    distributor: Distributor,
  ): Promise<void> {
    await enqueue(KEYS.DISCOVERED_DISTRIBUTORS, async () => {
      const existing = await getDiscoveredDistributors();
      if (existing.some((d) => d.id === distributor.id)) return;
      const next = [...existing, distributor];
      await persistDiscoveredDistributors(
        next.length > MAX_DISCOVERED_DISTRIBUTORS
          ? next.slice(next.length - MAX_DISCOVERED_DISTRIBUTORS)
          : next,
      );
    });
  }

  return {
    getDiscoveredProducts,
    saveDiscoveredProducts,
    addDiscoveredProduct,
    getDiscoveredDistributors,
    saveDiscoveredDistributors,
    addDiscoveredDistributor,
  };
}

// ─── Background task interval ────────────────────────────────────────────────
// Remembers the last registered background-task interval so a launch only
// re-registers when it actually changed. Re-registering on every launch resets
// the OS scheduling window (iOS) and can defer the task indefinitely.
//
// Stored as a per-task map under one key: the price-check and health-probe
// tasks share the `checkInterval` setting but register independently, and a
// single scalar was written by the price task before the health task read it —
// so after an interval change the health task saw the new value and skipped
// re-registering, staying on the old interval. A map keeps one key (so
// clearAllData's wipe still covers it) while tracking each task separately.
export function createBackgroundTaskStorage(ctx: StorageContext) {
  const { adapter, KEYS, enqueue } = ctx;

  async function readMap(): Promise<Record<string, number>> {
    try {
      const raw = await adapter.getItem(KEYS.BACKGROUND_TASK_INTERVAL);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const map: Record<string, number> = {};
      for (const [task, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
          map[task] = value;
        }
      }
      return map;
    } catch {
      return {};
    }
  }

  async function getBackgroundTaskInterval(
    task: string,
  ): Promise<number | null> {
    const map = await readMap();
    return map[task] ?? null;
  }

  async function saveBackgroundTaskInterval(
    minutes: number | null,
    task: string,
  ): Promise<void> {
    // Serialized like every other read-modify-write store: the two launch
    // registrations run unawaited, so without this both read `{}` and the
    // second write dropped the first task's marker (making it re-register on
    // every launch, which resets the OS scheduling window on iOS).
    await enqueue(KEYS.BACKGROUND_TASK_INTERVAL, async () => {
      try {
        const map = await readMap();
        if (minutes === null) {
          delete map[task];
        } else {
          map[task] = minutes;
        }
        if (Object.keys(map).length === 0) {
          await adapter.removeItem(KEYS.BACKGROUND_TASK_INTERVAL);
        } else {
          await adapter.setItem(
            KEYS.BACKGROUND_TASK_INTERVAL,
            JSON.stringify(map),
          );
        }
      } catch {
        // best effort
      }
    });
  }

  return { getBackgroundTaskInterval, saveBackgroundTaskInterval };
}
