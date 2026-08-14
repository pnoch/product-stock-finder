import { createTRPCClient } from "./trpc";
import type { PricePoint, ServerPriceResult } from "./types";

const TIMEOUT_MS = 4000;

export async function fetchServerPrice(
  distributorId: string,
  modelNumber: string,
): Promise<ServerPriceResult | null> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.prices.get.query({ distributorId, modelNumber }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    if (!result || !result.snapshot) return null;
    return result;
  } catch {
    return null;
  }
}

export async function uploadServerHistory(
  distributorId: string,
  modelNumber: string,
  points: PricePoint[],
): Promise<void> {
  try {
    const client = createTRPCClient();
    await client.prices.uploadHistory.mutate({
      distributorId,
      modelNumber,
      points,
    });
  } catch {
    // Swallow — history upload is best-effort
  }
}
