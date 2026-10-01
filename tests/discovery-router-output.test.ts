import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { clearRateLimitsForTests } from "../server/rate-limit";

const llm = vi.hoisted(() => ({ content: "" as unknown }));
vi.mock("../server/_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    choices: [{ message: { content: llm.content } }],
  })),
}));

function authedCtx(ip = "9.9.9.9"): TrpcContext {
  return {
    user: {
      id: 3,
      openId: "open-3",
      name: null,
      email: null,
      loginMethod: null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
      ip,
      socket: { remoteAddress: ip },
    } as unknown as TrpcContext["req"],
    res: {
      clearCookie: (_name: string, _options: Record<string, unknown>) => {},
    } as TrpcContext["res"],
    deviceId: null,
  };
}

function response(product: Record<string, unknown>, retailers: unknown) {
  return JSON.stringify({ product, retailers });
}

const product = {
  name: "CRS804",
  modelNumber: "CRS804-1G-4S+IN",
  brand: "MikroTik",
  category: "Switch",
  description: "A switch.",
};

beforeEach(() => {
  clearRateLimitsForTests();
});

describe("discovery.discover output shaping", () => {
  it("maps retailers, keeping only valid http(s) websites", async () => {
    llm.content = response(product, [
      {
        name: "Server2U",
        website: "https://server2u.my/crs804",
        country: "Malaysia",
        currency: "MYR",
      },
      { name: "NoSite", website: "javascript:alert(1)" },
      "not-an-object",
    ]);
    const result = await appRouter
      .createCaller(authedCtx())
      .discovery.discover({ query: "crs804" });

    expect(result.product).toMatchObject({
      name: "CRS804",
      modelNumber: "CRS804-1G-4S+IN",
      brand: "MikroTik",
    });
    expect(result.product.id).toMatch(/^discovered-\d+$/);

    expect(result.retailers).toHaveLength(3);
    expect(result.retailers[0]).toMatchObject({
      name: "Server2U",
      website: "https://server2u.my/crs804",
      country: "Malaysia",
      currency: "MYR",
    });
    // A non-http scheme is rejected to an empty string.
    expect(result.retailers[1]!.website).toBe("");
    // A non-object entry becomes an all-empty retailer rather than throwing.
    expect(result.retailers[2]).toMatchObject({ name: "", website: "" });
    expect(result.retailers[2]!.id).toMatch(/^retailer-\d+-2$/);
  });

  it("treats a non-array retailers field as empty", async () => {
    llm.content = response(product, "nope");
    const result = await appRouter
      .createCaller(authedCtx())
      .discovery.discover({ query: "crs804" });
    expect(result.retailers).toEqual([]);
  });

  it("rejects a non-JSON model response", async () => {
    llm.content = "not json at all";
    await expect(
      appRouter.createCaller(authedCtx()).discovery.discover({ query: "x" }),
    ).rejects.toThrow(/Failed to parse discovery response/);
  });

  it("rejects an incomplete product", async () => {
    llm.content = response({ name: "Only a name" }, []);
    await expect(
      appRouter.createCaller(authedCtx()).discovery.discover({ query: "x" }),
    ).rejects.toThrow(/Failed to parse discovery response/);
  });

  it("rejects a response whose content is not a string", async () => {
    llm.content = 42;
    await expect(
      appRouter.createCaller(authedCtx()).discovery.discover({ query: "x" }),
    ).rejects.toThrow(/Invalid LLM response/);
  });
});
