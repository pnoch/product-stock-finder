import { isServerConfigured } from "@/constants/oauth";
import { createTRPCClient } from "./trpc";
import { withTimeout } from "./with-timeout";

const TIMEOUT_MS = 20_000;

export interface LlmTestResult {
  ok: boolean;
  provider: string;
  reason?: "auth" | "error";
}

/**
 * Probes the user's configured BYO-LLM provider (via the server proxy) so the
 * settings screen can confirm the key/URL works. Returns null when the server
 * is unreachable or the call times out.
 */
export async function testLlmConnection(): Promise<LlmTestResult | null> {
  if (!isServerConfigured()) return null;
  try {
    const client = createTRPCClient();
    return await withTimeout(client.llm.test.mutate(), TIMEOUT_MS);
  } catch {
    return null;
  }
}
