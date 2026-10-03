import type { FxRatesResult } from "@/lib/types";

const TIMEOUT_MS = 4000;

export const FX_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function fetchFxRates(): Promise<FxRatesResult | null> {
  try {
    // Lazily loaded so importing this pure module never pulls the
    // Expo/native tRPC client chain (unimportable in offline unit tests).
    const { createTRPCClient } = await import("@/lib/trpc");
    const client = createTRPCClient();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), TIMEOUT_MS);
    });
    const fetchPromise = client.fx.get.query();
    fetchPromise.catch(() => {});
    const result = await Promise.race([fetchPromise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    if (!result || typeof result.rates !== "object" || result.rates === null) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}
