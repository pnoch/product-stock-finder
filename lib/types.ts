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
  expectedDate?: string;
  url: string;
  lastChecked: string;
  priceHistory: PricePoint[];
}

export interface PricePoint {
  date: string;
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
  addedAt: string;
  lastRefreshed?: string; // ISO date string — set when listings are refreshed
  isWatched: boolean;
  listings: DistributorListing[];
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

export interface AppSettings {
  theme: "light" | "dark" | "auto";
  displayCurrency: string;
  checkInterval: "manual" | "hourly" | "daily";
  notificationsEnabled: boolean;
  stockAlerts: boolean;
  priceAlerts: boolean;
}
