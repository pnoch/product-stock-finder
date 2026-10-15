export const EBAY_SEARCH_QUERY_MAX = 150;
export const EBAY_SEARCH_LIMIT = 20;

export interface EbaySearchListing {
  itemId: string;
  title: string;
  url: string;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  condition: string | null;
  seller: string | null;
  shipping: string | null;
}

export type EbaySearchResult =
  | { kind: "results"; source: "api" | "browser"; listings: EbaySearchListing[] }
  | { kind: "empty"; source: "api" | "browser" }
  | { kind: "unavailable"; reason: "network" | "blocked" | "busy" | "credentials" | "unreadable" | "not_configured" };
