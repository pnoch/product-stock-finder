import { StockStatus } from "../types";

export interface ScrapeResult {
  price: number;
  currency: string;
  stockStatus: StockStatus;
  expectedDate?: string;
  url: string;
  taxRate?: number; // set by scraper from country map
}

export interface DistributorParser {
  id: string;
  baseUrl: string;
  buildSearchUrl: (model: string) => string;
  parsePrice: (html: string, model?: string) => ScrapeResult | null;
  rateLimitMs: number;
  useBrowser?: boolean;
  browserOptions?: {
    waitForSelector?: string;
    timeoutMs?: number;
  };
}

export interface ScrapeJobResult {
  distributorId: string;
  productId: string;
  result: ScrapeResult | null;
  error?: string;
  durationMs: number;
}

export interface ScrapeStats {
  totalChecks: number;
  succeeded: number;
  failed: number;
  lastCheckTime: string;
  distributorStatuses: Record<
    string,
    {
      lastSuccess: string | null;
      lastError: string | null;
      consecutiveFailures: number;
    }
  >;
}
