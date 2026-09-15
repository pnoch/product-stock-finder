import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
}));

vi.mock("../server/sync-db", () => ({
  listChangedItems: vi.fn(async () => []),
  upsertSyncItem: vi.fn(),
  purgeOldTombstones: vi.fn(),
  shouldAcceptSyncWrite: vi.fn(),
  TOMBSTONE_PURGE_WINDOW_MS: 30 * 24 * 60 * 60 * 1000,
}));

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { listChangedItems } from "../server/sync-db";
import { getDb } from "../server/db";

const mockedGetDb = vi.mocked(getDb);
const mockedListChanged = vi.mocked(listChangedItems);

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "email",
    passwordHash: null,
    role: "user",
    emailVerified: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (_name: string, _options: Record<string, unknown>) => {},
    } as TrpcContext["res"],
    deviceId: null,
  };
}

describe("sync router", () => {
  it("pull returns empty items when DB is unavailable", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.sync.pull({ since: null });
    expect(result.items).toEqual([]);
    expect(typeof result.lastSyncedAt).toBe("number");
  });

  it("push accepts nothing when DB is unavailable", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.sync.push({ items: [] });
    expect(result).toEqual({ accepted: 0, stamped: [], rejected: [] });
  });

  it("rate limits pull after the per-minute budget", async () => {
    mockedGetDb.mockResolvedValue({} as never);
    const ctx = { ...createAuthContext(), req: { ...createAuthContext().req, ip: "10.9.9.21" } as TrpcContext["req"] };
    const caller = appRouter.createCaller(ctx);
    for (let i = 0; i < 60; i++) {
      await caller.sync.pull({ since: null });
    }
    await expect(caller.sync.pull({ since: null })).rejects.toThrow(/Rate limit exceeded/);
  });

  it("rejects non-finite or negative pull cursors", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.sync.pull({ since: NaN })).rejects.toThrow();
    await expect(caller.sync.pull({ since: -5 })).rejects.toThrow();
  });

  it("rejects non-finite sync timestamps on push", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const item = {
      collection: "watchlist" as const,
      id: "p1",
      data: { id: "p1" },
      updatedAt: Infinity,
      deletedAt: null,
    };
    await expect(caller.sync.push({ items: [item] })).rejects.toThrow();
  });
});

describe("sync pull cursor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListChanged.mockResolvedValue([]);
  });

  it("captures lastSyncedAt before querying changed items", async () => {
    mockedGetDb.mockResolvedValue({} as never);
    mockedListChanged.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return [];
    });
    const before = Date.now();
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.sync.pull({ since: null });
    // lastSyncedAt must be captured before the 50ms query delay, not after
    expect(result.lastSyncedAt).toBeLessThanOrEqual(before + 5);
  });

  it("returns the full state (since=null) when the cursor predates the tombstone window", async () => {
    mockedGetDb.mockResolvedValue({} as never);
    mockedListChanged.mockResolvedValue([]);
    const caller = appRouter.createCaller(createAuthContext());
    // A cursor older than the 30-day retention window triggers a full resync.
    const staleSince = Date.now() - 40 * 24 * 60 * 60 * 1000;
    const result = await caller.sync.pull({ since: staleSince });
    expect(result.fullResyncSince).not.toBeNull();
    // Must query with `since = null` (complete state), not the stale cursor —
    // otherwise untouched live rows are omitted and the client deletes them.
    expect(mockedListChanged).toHaveBeenCalledWith(1, null, 501, false);
  });

  it("uses the incremental cursor when it is inside the retention window", async () => {
    mockedGetDb.mockResolvedValue({} as never);
    mockedListChanged.mockResolvedValue([]);
    const caller = appRouter.createCaller(createAuthContext());
    const recentSince = Date.now() - 60_000;
    const result = await caller.sync.pull({ since: recentSince });
    expect(result.fullResyncSince).toBeNull();
    expect(mockedListChanged).toHaveBeenCalledWith(1, recentSince, 501, false);
  });
});
