import { createTRPCClient } from "./trpc";
import type { PricePoint, ServerPriceResult } from "./types";

export { isFreshPriceSnapshot } from "./price-freshness";

export async function fetchServerPrice(
  distributorId: string,
  modelNumber: string,
): Promise<ServerPriceResult | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.prices.get.query({ distributorId, modelNumber }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), TIMEOUT_MS);
      }),
    ]);
    if (!result) return null;
    if (!result.snapshot && !result.history?.length) return null;
    return {
      ...result,
      history: result.history ?? [],
    };
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
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
