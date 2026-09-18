import { isServerConfigured } from "@/constants/oauth";
import { createTRPCClient } from "./trpc";
import { withTimeout } from "./with-timeout";

const TIMEOUT_MS = 4000;

export interface PriceInsight {
  insight: string;
  generatedAt: number;
}

export async function fetchPriceInsight(
  productId: string,
): Promise<PriceInsight | null> {
  if (!isServerConfigured()) return null;
  try {
    const client = createTRPCClient();
    const result = await withTimeout(
      client.insights.get.query({ productId }),
      TIMEOUT_MS,
    );
    return result;
  } catch {
    return null;
  }
}
