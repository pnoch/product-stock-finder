import type { DistributorListing, Product } from "../../../lib/types";
import type { Storage } from "../../../lib/storage";

export const SEED_IDS = [
  "mikrotik-crs804-4ddq-hrm",
  "mikrotik-crs326-24s",
  "nvidia-rtx-4090",
  "apple-macbook-pro-m4-max",
  "raspberry-pi-5-8gb",
  "apple-airpods-max-2",
  "valve-steam-deck-oled",
] as const;

export type SeedCatalogProduct = Omit<Product, "addedAt" | "isWatched" | "listings">;

export interface LaunchDeps {
  storage: Storage;
  catalog: SeedCatalogProduct[];
  sampleListings: Record<string, DistributorListing[]>;
  freshen: (listings: DistributorListing[]) => DistributorListing[];
  startPoller: (intervalMinutes: number, apiBaseUrl: string) => Promise<void>;
  getApiBaseUrl: () => string;
  loadFx: (storage: Storage) => Promise<void>;
  maybeRefreshFx: (storage: Storage) => Promise<void>;
}

export async function runLaunchSequence(deps: LaunchDeps): Promise<void> {
  const {
    storage,
    catalog,
    sampleListings,
    freshen,
    startPoller,
    getApiBaseUrl,
    loadFx,
    maybeRefreshFx,
  } = deps;

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

  try {
    const settings = await storage.getSettings();
    if (settings?.checkInterval && settings.checkInterval !== "manual") {
      const minutes = settings.checkInterval === "hourly" ? 60 : 1440;
      try {
        await startPoller(minutes, getApiBaseUrl());
      } catch (e) {
        console.error("[App] launch poller start failed", e);
      }
    }
  } catch (e) {
    console.error("[App] launch poller start failed", e);
  }

  try {
    await loadFx(storage);
    await maybeRefreshFx(storage);
  } catch (e) {
    console.error("[App] fx warm failed", e);
  }
}
