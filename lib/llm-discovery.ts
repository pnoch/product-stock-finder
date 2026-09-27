import { Product, Distributor } from "./types";
import { getApiBaseUrl } from "@/constants/oauth";
import { defaultStorage } from "@/lib/storage";
import { BYO_LLM_AUTH_ERR_MSG, MAX_DISCOVERY_QUERY } from "@shared/const";

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
  kind: "network" | "server" | "timeout" | "parse" | "byo-auth";
  status?: number;
  cause?: unknown;
  constructor(kind: "network" | "server" | "timeout" | "parse" | "byo-auth", message: string, opts?: { status?: number; cause?: unknown }) {
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
  if (e instanceof DiscoveryError && e.kind === "byo-auth") {
    return {
      title: "Check your API key",
      message:
        "Your AI provider rejected the API key. Update it in Settings → AI / LLM, or switch back to the built-in provider.",
      retry: false,
    };
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

async function readTrpcErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: { json?: { message?: unknown }; message?: unknown };
    };
    const message = body?.error?.json?.message ?? body?.error?.message;
    return typeof message === "string" ? message : "";
  } catch {
    return "";
  }
}

/**
 * Auth + BYO-LLM headers for the discovery request. Each client registers its
 * own builder (mobile/desktop have separate auth and tRPC clients) — this
 * module cannot import either. Without them the protected `discovery.discover`
 * endpoint rejects with 401 wherever there is no session cookie (native mobile
 * and the desktop app, whose sessions are Bearer tokens), which the UI reported
 * as a bogus "Sign-in Required"; it also meant the user's configured BYO-LLM
 * provider was ignored for discovery.
 */
type DiscoveryHeadersProvider = () => Promise<Record<string, string>>;
let discoveryHeadersProvider: DiscoveryHeadersProvider | null = null;

export function setDiscoveryHeadersProvider(
  provider: DiscoveryHeadersProvider | null,
): void {
  discoveryHeadersProvider = provider;
}

async function discoveryHeaders(): Promise<Record<string, string>> {
  if (!discoveryHeadersProvider) return {};
  try {
    return await discoveryHeadersProvider();
  } catch {
    // Best-effort: never let header construction break discovery.
    return {};
  }
}

/**
 * Persistence surface for a discovered product. Injectable so a client whose
 * UI reads from its own store (the desktop mirrors to localStorage) does not
 * write discovered rows into the shared IDB-preferred default store, where its
 * own `getDiscoveredProducts` would never see them.
 */
export type DiscoveryStore = Pick<
  typeof defaultStorage,
  "addDiscoveredProduct" | "addDiscoveredDistributor"
>;

export async function discoverProduct(
  query: string,
  persist: DiscoveryStore = defaultStorage,
): Promise<{ product: Product; retailers: Distributor[] } | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new DiscoveryError("server", "Server not configured");
  // The server caps the query at MAX_DISCOVERY_QUERY and rejects longer ones
  // outright; trim here so a long paste fails loudly as an empty query rather
  // than as an opaque validation error.
  const boundedQuery = query.slice(0, MAX_DISCOVERY_QUERY);
  const url = `${baseUrl}/api/trpc/discovery.discover`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await discoveryHeaders()),
      },
      credentials: "include",
      body: JSON.stringify({ json: { query: boundedQuery } }),
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
  if (!res.ok) {
    // The server tags a rejected BYO-LLM key with a distinct token so we can
    // show "check your API key" instead of a generic server error. tRPC wraps
    // errors as { error: { json: { message } } } (or { error: { message } }).
    const message = await readTrpcErrorMessage(res);
    if (message.includes(BYO_LLM_AUTH_ERR_MSG)) {
      throw new DiscoveryError("byo-auth", message, { status: res.status });
    }
    throw new DiscoveryError("server", `Discovery failed (${res.status})`, { status: res.status });
  }
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

  await persist.addDiscoveredProduct(product);
  for (const retailer of retailers) {
    await persist.addDiscoveredDistributor(retailer);
  }

  return { product, retailers };
}
