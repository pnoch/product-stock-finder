import { createTRPCClient } from "./trpc";
import { isServerConfigured } from "@/constants/oauth";
import type { AvailableProduct } from "./types";

export type { AvailableProduct };

export async function fetchAvailable(params: {
  currency?: string;
  category?: string;
  brand?: string;
  maxPrice?: number;
} = {}): Promise<AvailableProduct[]> {
  if (!isServerConfigured()) return [];
  const client = createTRPCClient();
  return (await client.catalog.available.query(params)) as AvailableProduct[];
}
