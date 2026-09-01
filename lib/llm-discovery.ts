import { Product, Distributor } from "./types";
import { getApiBaseUrl } from "@/constants/oauth";
import { defaultStorage } from "@/lib/storage";

export class DiscoveryAuthError extends Error {
  kind = "auth" as const;
  status: number;
  constructor(status: number, message?: string) {
    super(message ?? `Authentication failed (${status})`);
    this.status = status;
    this.name = "DiscoveryAuthError";
  }
}

export async function discoverProduct(
  query: string,
): Promise<{ product: Product; retailers: Distributor[] } | null> {
  try {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return null;
    // tRPC mutation: discovery.discover — superjson body {json:{query}}
    const url = `${baseUrl}/api/trpc/discovery.discover`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ json: { query } }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    if (res.status === 401 || res.status === 403) throw new DiscoveryAuthError(res.status);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      result?: { data?: { json?: { product?: any; retailers?: any[] } } };
    };
    const data = body?.result?.data?.json;
    if (!data?.product) return null;

    const product: Product = {
      ...data.product,
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    };

    const retailers: Distributor[] = (data.retailers ?? []).map((r: any) => ({
      ...r,
      paymentMethods: r.paymentMethods ?? [],
      shippingCosts: r.shippingCosts ?? {},
    }));

    await defaultStorage.addDiscoveredProduct(product);
    for (const retailer of retailers) {
      await defaultStorage.addDiscoveredDistributor(retailer);
    }

    return { product, retailers };
  } catch (e) {
    if (e instanceof DiscoveryAuthError) throw e;
    return null;
  }
}
