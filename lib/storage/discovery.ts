import type { Product, Distributor } from "../types";
import type { StorageContext } from "./context";

export function createDiscoveryStorage(ctx: StorageContext) {
  const { adapter, KEYS, readList } = ctx;

  // ─── Discovered Products ────────────────────────────────────────────────────

  async function getDiscoveredProducts(): Promise<Product[]> {
    return readList<Product>(KEYS.DISCOVERED_PRODUCTS);
  }

  async function saveDiscoveredProducts(products: Product[]): Promise<void> {
    await adapter.setItem(KEYS.DISCOVERED_PRODUCTS, JSON.stringify(products));
  }

  async function addDiscoveredProduct(product: Product): Promise<void> {
    const existing = await getDiscoveredProducts();
    if (existing.some((p) => p.id === product.id)) return;
    await saveDiscoveredProducts([...existing, product]);
  }

  // ─── Discovered Distributors ────────────────────────────────────────────────

  async function getDiscoveredDistributors(): Promise<Distributor[]> {
    return readList<Distributor>(KEYS.DISCOVERED_DISTRIBUTORS);
  }

  async function saveDiscoveredDistributors(
    distributors: Distributor[],
  ): Promise<void> {
    await adapter.setItem(
      KEYS.DISCOVERED_DISTRIBUTORS,
      JSON.stringify(distributors),
    );
  }

  async function addDiscoveredDistributor(
    distributor: Distributor,
  ): Promise<void> {
    const existing = await getDiscoveredDistributors();
    if (existing.some((d) => d.id === distributor.id)) return;
    await saveDiscoveredDistributors([...existing, distributor]);
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
