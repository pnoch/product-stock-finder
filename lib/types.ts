export type StockStatus =
  | "in_stock"
  | "back_order"
  | "out_of_stock"
  | "unknown";

export interface PriceSnapshot {
  price: number;
  currency: string;
  stockStatus: StockStatus;
  expectedDate?: string;
  url: string;
  taxRate?: number;
  fetchedAt: number;
}

export interface TagDefinition {
  id: string;
  name: string;
  color: string;
}

export type WatchlistSort =
  | "recent"
  | "best_price"
  | "az"
  | "price_drop"
  | "status"
  | "region"
  | "deal";

export type WatchlistGroup = "off" | "tag" | "status" | "region";

export interface Distributor {
  id: string;
  name: string;
  country: string;
  countryFlag: string;
  region: string;
  website: string;
  paymentMethods: string[];
  notes?: string;
  currency: string; // native currency for shipping costs
  shippingCosts?: Record<string, number>; // destination region → shipping cost in distributor's currency
}

export interface DistributorListing {
  distributorId: string;
  productId: string;
  price: number;
  currency: string;
  stockStatus: StockStatus;
  expectedDate?: string;
  url: string;
  lastChecked: string;
  priceHistory: PricePoint[];
  taxRate?: number; // set by scraper from country map
}

export interface PricePoint {
  date: string;
  price: number;
  currency: string;
  stockStatus: StockStatus;
}

export interface ServerPriceResult {
  snapshot: PriceSnapshot | null;
  history: PricePoint[];
}

export interface FxRatesResult {
  rates: Record<string, number>;
  fetchedAt: number | null;
}

export interface Product {
  id: string;
  name: string;
  modelNumber: string;
  brand: string;
  category: string;
  description: string;
  imageUrl?: string;
  addedAt: string;
  lastRefreshed?: string; // ISO date string — set when listings are refreshed
  isWatched: boolean;
  listings: DistributorListing[];
  tags?: string[];
}

export interface PriceAlert {
  id: string;
  productId: string;
  targetPrice: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  triggeredAt?: string;
  triggeredPrice?: number; // actual price when alert fired
  distributorId?: string;
  direction?: "drop" | "rise"; // absent = drop
  snoozedUntil?: string;
}

export interface BackOrderReminder {
  id: string;
  productId: string;
  productName: string;
  distributorId: string;
  distributorName: string;
  reminderDate: string;
  notificationId?: string;
  createdAt: string;
  reminderType?: "date" | "back_in_stock";
  lastKnownStatus?: string;
}

export interface NotificationHistoryEntry {
  id: string;
  type: "price_drop" | "price_rise" | "restock" | "reminder" | "health" | "digest";
  title: string;
  body: string;
  productId?: string;
  distributorId?: string;
  healthStatus?: "blocked" | "error" | "recovered";
  triggeredPrice?: number;
  currency?: string;
  createdAt: number;
  read: boolean;
}

export interface AppSettings {
  theme: "light" | "dark" | "auto";
  displayCurrency: string;
  checkInterval: "manual" | "hourly" | "daily";
  notificationsEnabled: boolean;
  stockAlerts: boolean;
  priceAlerts: boolean;
  healthAlerts: boolean;
  enabledDistributors?: string[];
  lastScrapeTime?: string;
  shippingRegion?: string;
  digestFrequency?: "off" | "daily" | "weekly";
  digestDayOfWeek?: number; // 0=Sunday..6=Saturday, used when digestFrequency=weekly
  basketAlertThreshold?: number | null;
  webNotificationsEnabled?: boolean;
  tagDefinitions?: Record<string, TagDefinition>;
  watchlistSort?: WatchlistSort;
  watchlistGroup?: WatchlistGroup;
  watchlistSortKey?: "name" | "price" | "deal" | "trend" | "lastUpdated";
  watchlistSortAsc?: boolean;
  llmProvider?: "openai" | "ollama" | "ollama-local" | "forge";
  llmApiKey?: string;
  llmModel?: string;
  llmOllamaUrl?: string;
  quietHours?: { start: string; end: string; utcOffsetMinutes?: number };
  watchlistPriceRange?: [number, number] | null;
  watchlistInStockOnly?: boolean;
  retentionDays?: number;
}

export type Collection = "watchlist" | "alerts" | "reminders" | "settings";

export interface SyncItem {
  collection: Collection;
  id: string;
  data: unknown;
  updatedAt: number;
  deletedAt: number | null;
}

export interface SyncStampedItem {
  collection: Collection;
  id: string;
  updatedAt: number;
}

export type SyncRejectionReason = "stale_write" | "validation_error";

export interface SyncRejectedItem {
  collection: Collection;
  id: string;
  reason: SyncRejectionReason;
}

export interface SyncMeta {
  lastSyncedAt: number;
  lastSyncOkAt?: number;
  lastSyncError?: string | null;
  items: Record<
    string,
    Record<string, { updatedAt: number; deleted: boolean }>
  >;
  // `collection:id` keys the server rejected (validation/transient). Their meta
  // stamp is <= the cursor, so they must be retried explicitly on the next sync.
  retryKeys?: string[];
  // Settings as of the last successful sync. Used as the merge base so a pull
  // can keep local-only field edits instead of overwriting the whole row.
  settingsSnapshot?: Partial<AppSettings>;
}

export interface TrendingProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  estimatedPrice: number;
  currency: string;
  reason: string;
  source: string;
  fetchedAt: string;
  expiresAt: string;
}
