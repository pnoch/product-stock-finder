import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({})),
}));

vi.mock("../server/sync-db", () => ({
  listChangedItems: vi.fn(async () => []),
  upsertSyncItem: vi.fn(async () => ({ accepted: true, updatedAt: 1 })),
  purgeOldTombstones: vi.fn(),
  shouldAcceptSyncWrite: vi.fn(),
  TOMBSTONE_PURGE_WINDOW_MS: 30 * 24 * 60 * 60 * 1000,
}));

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { upsertSyncItem } from "../server/sync-db";

const mockedUpsert = vi.mocked(upsertSyncItem);

function ctx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "o",
      email: null,
      name: "U",
      loginMethod: null,
      passwordHash: null,
      role: "user",
      emailVerified: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", hostname: "localhost", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    deviceId: null,
  };
}

describe("sync.push future-stamp handling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clamps a far-future stamp instead of rejecting the whole batch", async () => {
    const caller = appRouter.createCaller(ctx());
    const farFuture = Date.now() + 60 * 60 * 1000;
    const result = await caller.sync.push({
      items: [
        {
          collection: "watchlist",
          id: "p1",
          data: { id: "p1" },
          updatedAt: farFuture,
          deletedAt: null,
        },
      ],
    });
    // Not rejected outright — the item is accepted with a clamped stamp.
    expect(result.accepted).toBe(1);
    expect(mockedUpsert).toHaveBeenCalledTimes(1);
    const sent = mockedUpsert.mock.calls[0]![1];
    expect(sent.updatedAt).toBeLessThanOrEqual(Date.now() + 5 * 60_000);
  });

  it("passes a normal stamp through unchanged", async () => {
    const caller = appRouter.createCaller(ctx());
    const normal = Date.now() - 1000;
    await caller.sync.push({
      items: [
        {
          collection: "watchlist",
          id: "p2",
          data: { id: "p2" },
          updatedAt: normal,
          deletedAt: null,
        },
      ],
    });
    expect(mockedUpsert.mock.calls[0]![1].updatedAt).toBe(normal);
  });
});
