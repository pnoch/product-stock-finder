import type { DistributorListing, Product } from "../types";
import type { StorageContext } from "./context";
import { MAX_HISTORY_PER_LISTING, maxHistoryPerProduct } from "./adapter";

export function createWatchlistStorage(ctx: StorageContext) {
  const { adapter, KEYS, notify, enqueue, readList } = ctx;

  // ─── Watchlist ──────────────────────────────────────────────────────────────

  async function getWatchlist(): Promise<Product[]> {
    return readList<Product>(KEYS.WATCHLIST);
  }

  function trimHistory(listings: DistributorListing[]): DistributorListing[] {
    let trimmed = listings.map((l) => {
      const h = l.priceHistory ?? [];
      if (h.length > MAX_HISTORY_PER_LISTING) return { ...l, priceHistory: h.slice(-MAX_HISTORY_PER_LISTING) };
      return l;
    });
    let total = trimmed.reduce((s, l) => s + (l.priceHistory?.length ?? 0), 0);
    if (total <= maxHistoryPerProduct) return trimmed;
    const mutable = trimmed.map((l) => ({ ...l, priceHistory: [...(l.priceHistory ?? [])] }));
    while (total > maxHistoryPerProduct) {
      let idx = -1;
      let maxLen = 0;
      for (let i = 0; i < mutable.length; i++) {
        const len = mutable[i].priceHistory.length;
        if (len > maxLen) {
          maxLen = len;
          idx = i;
        }
      }
      if (idx === -1 || maxLen === 0) break;
      mutable[idx].priceHistory.shift();
      total--;
    }
    return mutable;
  }

  function capProducts(products: Product[]): Product[] {
    let mutated = false;
    const next = products.map((p) => {
      const trimmed = trimHistory(p.listings ?? []);
      const orig = p.listings ?? [];
      const changed = trimmed.length !== orig.length || trimmed.some((l, i) => l.priceHistory !== orig[i]?.priceHistory);
      if (changed) {
        mutated = true;
        return { ...p, listings: trimmed };
      }
      return p;
    });
    return mutated ? next : products;
  }

  async function saveWatchlist(products: Product[]): Promise<void> {
    const capped = capProducts(products);
    await adapter.setItem(KEYS.WATCHLIST, JSON.stringify(capped));
  }

  // Enqueued read-modify-write so concurrent callers (sync engine, background
  // refresh) never lose each other's changes.
  async function updateWatchlist(
    fn: (list: Product[]) => Promise<Product[]> | Product[],
  ): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const next = await fn(list);
      await saveWatchlist(next);
    });
  }

  async function addToWatchlist(product: Product): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const exists = list.find((p) => p.id === product.id);
      if (!exists) {
        list.unshift({
          ...product,
          isWatched: true,
          addedAt: product.addedAt ?? new Date().toISOString(),
        });
        await saveWatchlist(list);
        notify("watchlist", product.id);
      }
    });
  }

  async function removeFromWatchlist(productId: string): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const next = list.filter((p) => p.id !== productId);
      if (next.length !== list.length) {
        await saveWatchlist(next);
        notify("watchlist", productId);
      }
    });
  }

  async function updateProductDetails(
    productId: string,
    fields: {
      name?: string;
      modelNumber?: string;
      brand?: string;
      category?: string;
      description?: string;
    },
  ): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const updated = list.map((p) => {
        if (p.id !== productId) return p;
        const next: Product = { ...p };
        if (fields.name?.trim()) next.name = fields.name.trim();
        if (fields.modelNumber?.trim())
          next.modelNumber = fields.modelNumber.trim();
        if (fields.brand !== undefined) next.brand = fields.brand.trim();
        if (fields.category !== undefined)
          next.category = fields.category.trim();
        if (fields.description !== undefined)
          next.description = fields.description.trim();
        return next;
      });
      await saveWatchlist(updated);
      notify("watchlist", productId);
    });
  }

  async function updateProductListings(
    productId: string,
    listings: DistributorListing[],
  ): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const now = new Date().toISOString();
      const updated = list.map((p) =>
        p.id === productId ? { ...p, listings, lastRefreshed: now } : p,
      );
      await saveWatchlist(updated);
      notify("watchlist", productId);
    });
  }

  async function refreshWatchlistPrices(): Promise<void> {
    await enqueue(KEYS.WATCHLIST, async () => {
      const list = await getWatchlist();
      const now = new Date().toISOString();
      const updated = list.map((p) => ({ ...p, lastRefreshed: now }));
      await saveWatchlist(updated);
      for (const p of updated) notify("watchlist", p.id);
    });
  }

  return {
    getWatchlist,
    saveWatchlist,
    updateWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    updateProductDetails,
    updateProductListings,
    refreshWatchlistPrices,
  };
}
