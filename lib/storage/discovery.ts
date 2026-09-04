import type { Product, Distributor } from "../types";
import type { StorageContext } from "./context";

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
      await persistDiscoveredProducts([...existing, product]);
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
      await persistDiscoveredDistributors([...existing, distributor]);
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
