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

export class DiscoveryError extends Error {
  kind: "network" | "server" | "timeout" | "parse";
  status?: number;
  cause?: unknown;
  constructor(kind: "network" | "server" | "timeout" | "parse", message: string, opts?: { status?: number; cause?: unknown }) {
    super(message);
    this.kind = kind;
    this.status = opts?.status;
    this.cause = opts?.cause;
    this.name = "DiscoveryError";
  }
}

export type DiscoverErrorState = { title: string; message: string; retry: boolean };

export function toDiscoverErrorState(e: unknown): DiscoverErrorState {
  if (e instanceof DiscoveryAuthError) {
    return { title: "Sign-in Required", message: "Please sign in to use AI discovery.", retry: false };
  }
  if (e instanceof DiscoveryError) {
    const message =
      e.kind === "timeout" ? "Discovery timed out. Check your connection and try again."
      : e.kind === "network" ? `Network error: ${e.message}`
      : e.kind === "server" ? (e.status ? `Server error (${e.status}). Try again in a moment.` : e.message)
      : "We couldn't parse the discovery response. Try again.";
    return { title: "Discovery Failed", message, retry: true };
  }
  return { title: "Discovery Failed", message: "We couldn't find that product. Try again.", retry: true };
}

export async function discoverProduct(
  query: string,
): Promise<{ product: Product; retailers: Distributor[] } | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new DiscoveryError("server", "Server not configured");
  const url = `${baseUrl}/api/trpc/discovery.discover`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ json: { query } }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof DiscoveryAuthError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new DiscoveryError("timeout", "Discovery timed out", { cause: e });
    }
    throw new DiscoveryError("network", e instanceof Error ? e.message : String(e), { cause: e });
  } finally {
    clearTimeout(timeout);
  }
  if (res.status === 401 || res.status === 403) throw new DiscoveryAuthError(res.status);
  if (!res.ok) throw new DiscoveryError("server", `Discovery failed (${res.status})`, { status: res.status });
  let body: { result?: { data?: { json?: { product?: any; retailers?: any[] } } } };
  try {
    body = (await res.json()) as typeof body;
  } catch (e) {
    throw new DiscoveryError("parse", "Invalid discovery response", { cause: e });
  }
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
}
