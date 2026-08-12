import { createTRPCClient } from "./trpc";
import type { PriceSnapshot } from "./types";

const TIMEOUT_MS = 4000;

export async function fetchServerPrice(
  distributorId: string,
  modelNumber: string,
): Promise<PriceSnapshot | null> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.prices.get.query({ distributorId, modelNumber }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    return result;
  } catch {
    return null;
  }
}