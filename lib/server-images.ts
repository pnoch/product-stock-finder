import { createTRPCClient } from "./trpc";

export interface ProductImage {
  imageUrl: string;
}

export async function fetchProductImage(
  productId: string,
  opts?: { timeoutMs?: number },
): Promise<ProductImage | null> {
  try {
    const client = createTRPCClient();
    const timeoutMs = opts?.timeoutMs ?? 4000;
    const result = await Promise.race([
      client.images.get.query({ productId }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return result;
  } catch {
    return null;
  }
}
