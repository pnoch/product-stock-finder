import { isServerConfigured } from "@/constants/oauth";
import { createTRPCClient } from "./trpc";

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
    const result = await Promise.race([
      client.insights.get.query({ productId }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return result;
  } catch {
    return null;
  }
}
