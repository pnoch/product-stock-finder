import { isServerConfigured } from "@/constants/oauth";
import { createTRPCClient } from "./trpc";
import { withTimeout } from "./with-timeout";

export interface ProductImage {
  imageUrl: string;
}

export async function fetchProductImage(
  productId: string,
  opts?: { timeoutMs?: number },
): Promise<ProductImage | null> {
  if (!isServerConfigured()) return null;
  try {
    const client = createTRPCClient();
    const timeoutMs = opts?.timeoutMs ?? 4000;
    const result = await withTimeout(
      client.images.get.query({ productId }),
      timeoutMs,
    );
    return result;
  } catch {
    return null;
  }
}
