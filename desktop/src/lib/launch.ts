import type { DistributorListing, Product } from "../../../lib/types";
import type { Storage } from "../../../lib/storage";
import { seedWatchlistProducts } from "../../../lib/launch-seed";

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

  await seedWatchlistProducts({ storage, catalog, sampleListings, freshen });

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
