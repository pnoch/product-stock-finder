import { createTRPCClient } from "./trpc";

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
    const result = await Promise.race([
      client.products.parse.query({ raw: raw.slice(0, 2000) }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return result?.product ?? null;
  } catch {
    return null;
  }
}
