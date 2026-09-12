import type { DistributorListing } from "./types";

export const SEED_IDS = [
  "mikrotik-crs804-4ddq-hrm",
  "mikrotik-crs326-24s",
  "nvidia-rtx-4090",
  "apple-macbook-pro-m4-max",
  "raspberry-pi-5-8gb",
  "apple-airpods-max-2",
  "valve-steam-deck-oled",
] as const;

export interface SeedDeps {
  storage: {
    getWatchlist(): Promise<Array<{ id: string; listings?: unknown[] }>>;
    addToWatchlist(product: unknown): Promise<unknown>;
    updateProductListings(id: string, listings: DistributorListing[]): Promise<unknown>;
  };
  catalog: Array<{ id: string }>;
  sampleListings: Record<string, DistributorListing[]>;
  freshen(listings: DistributorListing[]): DistributorListing[];
}

export async function seedWatchlistProducts(deps: SeedDeps): Promise<void> {
  const { storage, catalog, sampleListings, freshen } = deps;

  try {
    const watchlist = await storage.getWatchlist();
    const existingIds = new Set(watchlist.map((p) => p.id));
    const existingById = new Map(watchlist.map((p) => [p.id, p] as const));
    for (const id of SEED_IDS) {
      try {
        if (existingIds.has(id)) {
          const existing = existingById.get(id)!;
          if (
            (id === "mikrotik-crs804-4ddq-hrm" ||
              id === "mikrotik-crs326-24s") &&
            (!existing.listings || existing.listings.length === 0)
          ) {
            await storage.updateProductListings(
              id,
              freshen(sampleListings[id] ?? []),
            );
          }
          continue;
        }
        const product = catalog.find((p) => p.id === id);
        if (!product) continue;
        await storage.addToWatchlist({
          ...product,
          isWatched: true,
          addedAt: new Date().toISOString(),
          listings: freshen(sampleListings[id] ?? []),
        });
      } catch (e) {
        console.error(`[Seed] failed for ${id}:`, e);
      }
    }
  } catch (e) {
    console.error("[Seed] failed:", e);
  }
}
