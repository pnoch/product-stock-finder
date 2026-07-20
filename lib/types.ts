export type StockStatus = "in_stock" | "back_order" | "out_of_stock" | "unknown";

export interface Distributor {
  id: string;
  name: string;
  country: string;
  countryFlag: string;
  region: string;
  website: string;
  paymentMethods: string[];
  notes?: string;
}

export interface DistributorListing {
  distributorId: string;
  productId: string;
  price: number;
  currency: string;
  stockStatus: StockStatus;
  expectedDate?: string; // ISO date string for back_order
  url: string;
  lastChecked: string; // ISO date string
  priceHistory: PricePoint[];
}

export interface PricePoint {
  date: string; // ISO date string
  price: number;
  currency: string;
  stockStatus: StockStatus;
}

export interface Product {
  id: string;
  name: string;
  modelNumber: string;
  brand: string;
  category: string;
  description: string;
  imageUrl?: string;
  addedAt: string; // ISO date string
  isWatched: boolean;
  listings: DistributorListing[];
  note?: string;
}

export interface PriceAlert {
  id: string;
  productId: string;
  targetPrice: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  triggeredAt?: string;
  purchasedAt?: string;
  distributorId?: string; // optional: alert for specific distributor
}

export interface AppSettings {
  theme: "light" | "dark" | "auto";
  displayCurrency: string;
  checkInterval: "manual" | "hourly" | "daily";
  notificationsEnabled: boolean;
  stockAlerts: boolean;
  priceAlerts: boolean;
}
