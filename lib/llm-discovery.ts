import { Product, Distributor } from "./types";
import { getApiBaseUrl } from "@/constants/oauth";
import { defaultStorage } from "@/lib/storage";

export async function discoverProduct(
  query: string,
): Promise<{ product: Product; retailers: Distributor[] } | null> {
  try {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return null;
    const res = await fetch(`${baseUrl}/api/discovery/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const product: Product = {
      ...data.product,
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    };

    const retailers = data.retailers.map((r: any) => ({
      ...r,
      paymentMethods: r.paymentMethods ?? [],
      shippingCosts: r.shippingCosts ?? {},
    }));

    await defaultStorage.addDiscoveredProduct(product);
    for (const retailer of retailers) {
      await defaultStorage.addDiscoveredDistributor(retailer);
    }

    return { product, retailers };
  } catch {
    return null;
  }
}
