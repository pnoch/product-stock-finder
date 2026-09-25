export interface LlmTestResult {
  ok: boolean;
  provider: string;
  reason?: "auth" | "error";
}

/**
 * Probes the user's configured BYO-LLM provider (via the server proxy) so the
 * settings screen can confirm the key/URL works. Returns null when the server
 * is unreachable. The tRPC client forwards the x-llm-* headers from settings.
 */
export async function testLlmConnection(): Promise<LlmTestResult | null> {
  try {
    const { createTRPCClient } = await import("./trpc");
    return await createTRPCClient().llm.test.mutate();
  } catch {
    return null;
  }
}
