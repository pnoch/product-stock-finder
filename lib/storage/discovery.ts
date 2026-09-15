import type { Product, Distributor } from "../types";
import type { StorageContext } from "./context";

// Discovery results are persisted to AsyncStorage with no UI to prune them, so
// bound the arrays (keep the newest) like every other stored collection.
const MAX_DISCOVERED_PRODUCTS = 200;
const MAX_DISCOVERED_DISTRIBUTORS = 200;

export function createDiscoveryStorage(ctx: StorageContext) {
  const { adapter, KEYS, enqueue, readList } = ctx;

  // ─── Discovered Products ────────────────────────────────────────────────────

  async function getDiscoveredProducts(): Promise<Product[]> {
    return readList<Product>(KEYS.DISCOVERED_PRODUCTS);
  }

  async function persistDiscoveredProducts(products: Product[]): Promise<void> {
    await adapter.setItem(KEYS.DISCOVERED_PRODUCTS, JSON.stringify(products));
  }

  async function saveDiscoveredProducts(products: Product[]): Promise<void> {
    await enqueue(KEYS.DISCOVERED_PRODUCTS, () =>
      persistDiscoveredProducts(products),
    );
  }

  async function addDiscoveredProduct(product: Product): Promise<void> {
    await enqueue(KEYS.DISCOVERED_PRODUCTS, async () => {
      const existing = await getDiscoveredProducts();
      if (existing.some((p) => p.id === product.id)) return;
      const next = [...existing, product];
      await persistDiscoveredProducts(
        next.length > MAX_DISCOVERED_PRODUCTS
          ? next.slice(next.length - MAX_DISCOVERED_PRODUCTS)
          : next,
      );
    });
  }

  // ─── Discovered Distributors ────────────────────────────────────────────────

  async function getDiscoveredDistributors(): Promise<Distributor[]> {
    return readList<Distributor>(KEYS.DISCOVERED_DISTRIBUTORS);
  }

  async function persistDiscoveredDistributors(
    distributors: Distributor[],
  ): Promise<void> {
    await adapter.setItem(
      KEYS.DISCOVERED_DISTRIBUTORS,
      JSON.stringify(distributors),
    );
  }

  async function saveDiscoveredDistributors(
    distributors: Distributor[],
  ): Promise<void> {
    await enqueue(KEYS.DISCOVERED_DISTRIBUTORS, () =>
      persistDiscoveredDistributors(distributors),
    );
  }

  async function addDiscoveredDistributor(
    distributor: Distributor,
  ): Promise<void> {
    await enqueue(KEYS.DISCOVERED_DISTRIBUTORS, async () => {
      const existing = await getDiscoveredDistributors();
      if (existing.some((d) => d.id === distributor.id)) return;
      const next = [...existing, distributor];
      await persistDiscoveredDistributors(
        next.length > MAX_DISCOVERED_DISTRIBUTORS
          ? next.slice(next.length - MAX_DISCOVERED_DISTRIBUTORS)
          : next,
      );
    });
  }

  return {
    getDiscoveredProducts,
    saveDiscoveredProducts,
    addDiscoveredProduct,
    getDiscoveredDistributors,
    saveDiscoveredDistributors,
    addDiscoveredDistributor,
  };
}
