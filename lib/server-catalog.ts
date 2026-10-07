import { createTRPCClient } from "./trpc";
import { isServerConfigured } from "@/constants/oauth";
import type { AvailableProduct } from "../server/available";

export type { AvailableProduct };

export async function fetchAvailable(params: {
  currency?: string;
  category?: string;
  brand?: string;
  maxPrice?: number;
} = {}): Promise<AvailableProduct[]> {
  if (!isServerConfigured()) return [];
  try {
    const client = createTRPCClient();
    return (await client.catalog.available.query(params)) as AvailableProduct[];
  } catch {
    return [];
  }
}
