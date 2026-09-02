export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}

export const DISTRIBUTOR_BREAKER_KEY = "distributor_breaker";

// Cap price history to avoid exceeding 5 MB localStorage quota on web.
// With 50 products × 25 distributors × 90 days ≈ 112k points, capped at 500
// per product keeps the payload well within quota and IDB limits.
export const maxHistoryPerProduct = 500;
export const MAX_HISTORY_PER_LISTING = 500;
