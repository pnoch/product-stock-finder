import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock constants/oauth
vi.mock("../constants/oauth", () => ({
  getApiBaseUrl: vi.fn(() => "http://localhost:3000"),
  isServerConfigured: vi.fn(() => true),
}));

// In-memory AsyncStorage mock
const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => store.delete(k));
    },
  },
}));

import { discoverProduct, toDiscoverErrorState, DiscoveryAuthError, DiscoveryError, setDiscoveryHeadersProvider } from "../lib/llm-discovery";
import { MAX_DISCOVERY_QUERY } from "../shared/const";
import { BYO_LLM_AUTH_ERR_MSG } from "../shared/const";

describe("discoverProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
  });

  it("returns product and retailers on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          data: {
            json: {
              product: {
                name: "Sony WH-1000XM5",
                modelNumber: "WH-1000XM5",
                brand: "Sony",
                category: "Headphones",
                description: "Noise-canceling headphones",
              },
              retailers: [
                {
                  name: "Amazon",
                  website: "https://amazon.com",
                  country: "US",
                  currency: "USD",
                },
              ],
            },
          },
        },
      }),
    });

    const result = await discoverProduct("Sony WH-1000XM5");
    expect(result).not.toBeNull();
    expect(result!.product.name).toBe("Sony WH-1000XM5");
    expect(result!.retailers).toHaveLength(1);
    expect(result!.retailers[0].name).toBe("Amazon");
  });

  it("bounds the query to the server's MAX_DISCOVERY_QUERY", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          data: {
            json: {
              product: {
                name: "Sony WH-1000XM5",
                modelNumber: "WH-1000XM5",
                brand: "Sony",
                category: "Headphones",
                description: "Noise-canceling headphones",
              },
              retailers: [],
            },
          },
        },
      }),
    });
    await discoverProduct("x".repeat(MAX_DISCOVERY_QUERY + 50));
    const call = mockFetch.mock.calls.at(-1)!;
    const body = JSON.parse((call[1] as { body: string }).body);
    // The server rejects a longer query outright, so the client trims it.
    expect(body.json.query).toHaveLength(MAX_DISCOVERY_QUERY);
  });

  it("throws typed DiscoveryError on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(discoverProduct("nonexistent")).rejects.toMatchObject({ name: "DiscoveryError", kind: "server" });
  });

  // QA round 299: the raw discovery fetch carried no auth/BYO headers, so the
  // protected endpoint 401'd wherever there was no session cookie (native,
  // desktop) and the user's own provider was ignored.
  it("sends the registered API headers (auth + BYO-LLM)", async () => {
    setDiscoveryHeadersProvider(async () => ({
      Authorization: "Bearer tok",
      "x-llm-provider": "openai",
    }));
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: { data: { json: { product: null } } } }),
    });
    await discoverProduct("rtx 5090").catch(() => {});
    const init = mockFetch.mock.calls.at(-1)?.[1] as RequestInit;
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer tok",
      "x-llm-provider": "openai",
    });
    setDiscoveryHeadersProvider(null);
  });

  it("omits auth headers when no provider is registered", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: { data: { json: { product: null } } } }),
    });
    await discoverProduct("rtx 5090").catch(() => {});
    const init = mockFetch.mock.calls.at(-1)?.[1] as RequestInit;
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("maps a rejected BYO key to a byo-auth error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 412,
      json: async () => ({ error: { json: { message: BYO_LLM_AUTH_ERR_MSG } } }),
    });
    await expect(discoverProduct("rtx 5090")).rejects.toMatchObject({
      name: "DiscoveryError",
      kind: "byo-auth",
    });
  });

  it("returns null on invalid JSON response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => "not json",
    });
    const result = await discoverProduct("bad response");
    expect(result).toBeNull();
  });

  it("throws typed DiscoveryError when getApiBaseUrl returns empty string", async () => {
    const { getApiBaseUrl } = await import("../constants/oauth");
    vi.mocked(getApiBaseUrl).mockReturnValueOnce("");
    await expect(discoverProduct("test")).rejects.toMatchObject({ name: "DiscoveryError", kind: "server" });
  });
});

describe("toDiscoverErrorState", () => {
  it("maps auth errors with no retry", () => {
    expect(toDiscoverErrorState(new DiscoveryAuthError(401))).toEqual({
      title: "Sign-in Required",
      message: "Please sign in to use AI discovery.",
      retry: false,
    });
  });

  it("maps BYO-LLM key rejection to an actionable, non-retry prompt", () => {
    expect(toDiscoverErrorState(new DiscoveryError("byo-auth", "boom"))).toEqual({
      title: "Check your API key",
      message:
        "Your AI provider rejected the API key. Update it in Settings → AI / LLM, or switch back to the built-in provider.",
      retry: false,
    });
  });

  it("maps timeout errors", () => {
    expect(toDiscoverErrorState(new DiscoveryError("timeout", "timed out"))).toEqual({
      title: "Discovery Failed",
      message: "Discovery timed out. Check your connection and try again.",
      retry: true,
    });
  });

  it("maps network errors with cause message", () => {
    expect(toDiscoverErrorState(new DiscoveryError("network", "boom"))).toEqual({
      title: "Discovery Failed",
      message: "Network error: boom",
      retry: true,
    });
  });

  it("maps server errors with status", () => {
    expect(toDiscoverErrorState(new DiscoveryError("server", "boom", { status: 500 }))).toEqual({
      title: "Discovery Failed",
      message: "Server error (500). Try again in a moment.",
      retry: true,
    });
  });

  it("maps server errors without status to raw message", () => {
    expect(toDiscoverErrorState(new DiscoveryError("server", "boom"))).toEqual({
      title: "Discovery Failed",
      message: "boom",
      retry: true,
    });
  });

  it("maps parse errors", () => {
    expect(toDiscoverErrorState(new DiscoveryError("parse", "bad"))).toEqual({
      title: "Discovery Failed",
      message: "We couldn't parse the discovery response. Try again.",
      retry: true,
    });
  });

  it("maps unknown errors to generic message", () => {
    expect(toDiscoverErrorState(new Error("nope"))).toEqual({
      title: "Discovery Failed",
      message: "We couldn't find that product. Try again.",
      retry: true,
    });
  });
});
