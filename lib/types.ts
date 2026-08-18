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
  | "region";

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
  type: "price_drop" | "restock" | "reminder";
  title: string;
  body: string;
  productId: string;
  distributorId?: string;
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
  enabledDistributors?: string[];
  lastScrapeTime?: string;
  shippingRegion?: string;
  digestFrequency?: "off" | "daily" | "weekly";
  webNotificationsEnabled?: boolean;
  tagDefinitions?: Record<string, TagDefinition>;
  watchlistSort?: WatchlistSort;
  watchlistGroup?: WatchlistGroup;
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

export interface SyncMeta {
  lastSyncedAt: number;
  lastSyncOkAt?: number;
  lastSyncError?: string | null;
  items: Record<
    string,
    Record<string, { updatedAt: number; deleted: boolean }>
  >;
}
