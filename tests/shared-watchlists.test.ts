import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getDb: vi.fn(),
}));

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { sharedWatchlists } from "../drizzle/schema";
import { getDb } from "../server/db";

const mockedGetDb = vi.mocked(getDb);

function createAuthedContext(userId = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `open-${userId}`,
      name: null,
      email: null,
      loginMethod: null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    req: { headers: {} } as unknown as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    deviceId: null,
  };
}
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { headers: {} } as unknown as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    deviceId: null,
  };
}

function fakeDb(opts: { sharedRows?: unknown[]; watchlistRows?: unknown[] }): unknown {
  const sharedRows = opts.sharedRows ?? [];
  const watchlistRows = opts.watchlistRows ?? [];
  return {
    insert: () => ({ values: async () => {} }),
    select: () => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          const rows = table === sharedWatchlists ? sharedRows : watchlistRows;
          const promise: unknown = Promise.resolve(rows);
          (promise as Record<string, unknown>).limit = async (n: number) => (rows as unknown[]).slice(0, n);
          return promise as unknown;
        },
      }),
    }),
    delete: () => ({ where: async () => {} }),
  };
}

describe("sharedWatchlists table", () => {
  it("has required columns", async () => {
    const mod = await import("../drizzle/schema");
    expect(mod.sharedWatchlists).toBeDefined();
    expect(mod.sharedWatchlists.token).toBeDefined();
  });
});

describe("sharedWatchlists router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("create returns shareUrl with /w/<token>", async () => {
    mockedGetDb.mockResolvedValue(fakeDb({}) as never);
    const caller = appRouter.createCaller(createAuthedContext(1));
    const res = await caller.sharedWatchlists.create({});
    expect(res.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.shareUrl).toContain(`/w/${res.token}`);
    expect(res.shareUrl).toMatch(/^http:\/\/localhost:8081\/w\//);
  });

  it("create respects EXPO_PUBLIC_WEB_URL origin", async () => {
    const prev = process.env.EXPO_PUBLIC_WEB_URL;
    process.env.EXPO_PUBLIC_WEB_URL = "https://example.com";
    mockedGetDb.mockResolvedValue(fakeDb({}) as never);
    const caller = appRouter.createCaller(createAuthedContext(1));
    const res = await caller.sharedWatchlists.create({ title: "My List" });
    expect(res.shareUrl.startsWith("https://example.com/w/")).toBe(true);
    process.env.EXPO_PUBLIC_WEB_URL = prev;
  });

  it("create requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.sharedWatchlists.create({})).rejects.toThrow();
  });

  it("get is public and returns products", async () => {
    const watchlistRows = [
      { deletedAtMs: null, data: { id: "p1", name: "Product 1" } },
      { deletedAtMs: null, data: { id: "p2", name: "Product 2" } },
      { deletedAtMs: 123, data: { id: "p3", name: "Deleted" } },
    ];
    mockedGetDb.mockResolvedValue(
      fakeDb({
        sharedRows: [{ ownerId: 1, token: "tok123", title: "My Watchlist" }],
        watchlistRows,
      }) as never,
    );
    const caller = appRouter.createCaller(createPublicContext());
    const res = await caller.sharedWatchlists.get({ token: "tok123" });
    expect(res.title).toBe("My Watchlist");
    expect(res.products).toHaveLength(2);
    expect(res.products.map((p: unknown) => (p as { id: string }).id)).toEqual(["p1", "p2"]);
  });

  it("get throws NOT_FOUND for unknown token", async () => {
    mockedGetDb.mockResolvedValue(fakeDb({ sharedRows: [] }) as never);
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.sharedWatchlists.get({ token: "missing" })).rejects.toThrow(/NOT_FOUND|Share not found/);
  });

  it("caps the returned products and flags truncation", async () => {
    const watchlistRows = Array.from({ length: 600 }, (_, i) => ({
      deletedAtMs: null,
      data: { id: `p${i}`, name: `Product ${i}` },
    }));
    mockedGetDb.mockResolvedValue(
      fakeDb({
        sharedRows: [{ ownerId: 1, token: "tok123", title: "Big" }],
        watchlistRows,
      }) as never,
    );
    const caller = appRouter.createCaller(createPublicContext());
    const res = await caller.sharedWatchlists.get({ token: "tok123" });
    expect(res.products).toHaveLength(500);
    expect(res.truncated).toBe(true);
  });

  it("revoke requires auth and returns revoked", async () => {
    mockedGetDb.mockResolvedValue(fakeDb({}) as never);
    const caller = appRouter.createCaller(createAuthedContext(1));
    const res = await caller.sharedWatchlists.revoke({ token: "tok123" });
    expect(res.revoked).toBe(true);
  });

  it("revoke requires auth for public", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.sharedWatchlists.revoke({ token: "tok123" })).rejects.toThrow();
  });
});
