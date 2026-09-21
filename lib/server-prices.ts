import { createTRPCClient } from "./trpc";
import { getApiBaseUrl } from "@/constants/oauth";
import { backgroundFetch } from "./background-fetch";
import { getBackgroundAppState } from "./background-safe-timers";
import type { PricePoint, ServerPriceResult } from "./types";

export { isFreshPriceSnapshot } from "./price-freshness";

const TIMEOUT_MS = 4000;

// Direct tRPC GET call for the backgrounded path. The tRPC client's batch
// loader dispatches via setTimeout, which never fires while the app is
// backgrounded (all JS timers freeze), so the query would hang forever. This
// bypasses the client and hits the HTTP endpoint with the same superjson
// batch format, using a fetch whose timeout is enforced natively.
async function fetchServerPriceDirect(
  distributorId: string,
  modelNumber: string,
): Promise<ServerPriceResult | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return null;
  const input = encodeURIComponent(
    JSON.stringify({ "0": { json: { distributorId, modelNumber } } }),
  );
  const { html, status } = await backgroundFetch(
    `${baseUrl}/api/trpc/prices.get?batch=1&input=${input}`,
    TIMEOUT_MS,
  );
  if (status !== 200) return null;
  const parsed = JSON.parse(html) as {
    0?: {
      result?: {
        data?: { json?: ServerPriceResult | null };
        error?: unknown;
      };
    };
  };
  const json = parsed[0]?.result?.data?.json;
  if (!json) return null;
  if (!json.snapshot && !json.history?.length) return null;
  return { ...json, history: json.history ?? [] };
}

export async function fetchServerPrice(
  distributorId: string,
  modelNumber: string,
): Promise<ServerPriceResult | null> {
  try {
    if (getBackgroundAppState() === "background") {
      return await fetchServerPriceDirect(distributorId, modelNumber);
    }
    const client = createTRPCClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
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
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
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