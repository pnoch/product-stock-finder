import { createTRPCClient } from "./trpc";
import { backgroundSafeRace, getBackgroundAppState } from "./background-safe-timers";
import type { PricePoint, ServerPriceResult } from "./types";

export { isFreshPriceSnapshot } from "./price-freshness";

const TIMEOUT_MS = 4000;

export async function fetchServerPrice(
  distributorId: string,
  modelNumber: string,
): Promise<ServerPriceResult | null> {
  try {
    const client = createTRPCClient();
    const result =
      getBackgroundAppState() === "background"
        ? // Android backgrounded: plain setTimeout freezes (frame-driven timers
          // are paused), so race against the 0ms-timer poll loop instead.
          await backgroundSafeRace(
            client.prices.get.query({ distributorId, modelNumber }),
            TIMEOUT_MS,
          )
        : await (async () => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              return await Promise.race([
                client.prices.get.query({ distributorId, modelNumber }),
                new Promise<null>((resolve) => {
                  timer = setTimeout(() => resolve(null), TIMEOUT_MS);
                }),
              ]);
            } finally {
              if (timer !== undefined) clearTimeout(timer);
            }
          })();
    if (!result) return null;
    if (!result.snapshot && !result.history?.length) return null;
    return {
      ...result,
      history: result.history ?? [],
    };
  } catch {
    return null;
  }
}

export async function uploadServerHistory(
  distributorId: string,
  modelNumber: string,
  points: PricePoint[],
): Promise<boolean> {
  try {
    const client = createTRPCClient();
    await client.prices.uploadHistory.mutate({
      distributorId,
      modelNumber,
      points,
    });
    return true;
  } catch {
    // Swallow — history upload is best-effort. Return false so callers can
    // distinguish a real upload from a failed attempt.
    return false;
  }
}
