import { createTRPCClient } from "./trpc";
import { withTimeout } from "./with-timeout";

const TIMEOUT_MS = 8000;

export interface ParsedProduct {
  name: string;
  modelNumber: string;
  brand: string;
  category: string;
  description: string;
}

export async function fetchParsedProduct(
  raw: string,
): Promise<ParsedProduct | null> {
  try {
    const client = createTRPCClient();
    // `withTimeout` clears its timer on settle (a bare Promise.race leaked the
    // timer, keeping the event loop alive up to the deadline) and uses the
    // background-safe poll loop while the app is backgrounded.
    const result = await withTimeout(
      client.products.parse.query({ raw: raw.slice(0, 2000) }),
      TIMEOUT_MS,
    );
    return result?.product ?? null;
  } catch {
    return null;
  }
}
