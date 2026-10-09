import type { Product } from "./types";

/** A product the user has marked as bought. */
export function isAcquired(product: Product): boolean {
  return typeof product.acquiredAt === "string" && product.acquiredAt.length > 0;
}

/** The products still to buy (unacquired). */
export function activeProducts(products: Product[]): Product[] {
  return products.filter((p) => !isAcquired(p));
}
