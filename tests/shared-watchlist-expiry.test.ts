import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getDb: vi.fn(),
}));

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
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

type SharedRow = {
  ownerId: number;
  token: string;
  title: string;
  createdAt: Date;
  expiresAt: Date | null;
};

function fakeDb(sharedRows: SharedRow[]) {
  const state: { updated: Record<string, unknown> | null } = { updated: null };
  const db = {
    insert: () => ({ values: async () => {} }),
    select: () => ({
      from: () => ({
        where: (..._args: unknown[]) => {
          const rows = [...sharedRows].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          );
          const promise: unknown = Promise.resolve(rows);
          (promise as Record<string, unknown>).limit = async (n: number) => rows.slice(0, n);
          (promise as Record<string, unknown>).orderBy = async () => rows;
          return promise as unknown;
        },
      }),
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => ({
        where: async (..._args: unknown[]) => {
          state.updated = vals;
        },
      }),
    }),
    delete: () => ({ where: async () => {} }),
  };
  return { db, state };
}

describe("sharedWatchlists list/extend", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list returns only the caller's links, newest first", async () => {
    const { db } = fakeDb([
      { ownerId: 1, token: "new", title: "New", createdAt: new Date("2026-09-10"), expiresAt: new Date("2026-10-10") },
      { ownerId: 1, token: "old", title: "Old", createdAt: new Date("2026-09-01"), expiresAt: new Date("2026-10-01") },
    ]);
    mockedGetDb.mockResolvedValue(db as never);
    const caller = appRouter.createCaller(createAuthedContext(1));
    const res = await caller.sharedWatchlists.list();
    expect(res.links.map((l) => l.token)).toEqual(["new", "old"]);
    expect(res.links[0]?.shareUrl).toContain("/w/new");
    expect(typeof res.links[0]?.expiresAt).toBe("string");
  });

  it("list requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.sharedWatchlists.list()).rejects.toThrow();
  });

  it("extend pushes expiry ~30 days out for the owner's token", async () => {
    const { db, state } = fakeDb([
      { ownerId: 1, token: "tok", title: "Mine", createdAt: new Date("2026-09-01"), expiresAt: new Date("2026-09-20") },
    ]);
    mockedGetDb.mockResolvedValue(db as never);
    const caller = appRouter.createCaller(createAuthedContext(1));
    const before = Date.now();
    const res = await caller.sharedWatchlists.extend({ token: "tok" });
    const expiry = new Date(res.expiresAt).getTime();
    expect(expiry - before).toBeGreaterThan(29 * 86400000);
    expect(expiry - before).toBeLessThanOrEqual(30 * 86400000 + 60000);
    expect(state.updated).toMatchObject({ expiresAt: expect.any(Date) });
  });

  it("extend rejects another owner's token", async () => {
    const { db } = fakeDb([
      { ownerId: 2, token: "tok", title: "Theirs", createdAt: new Date("2026-09-01"), expiresAt: new Date("2026-09-20") },
    ]);
    mockedGetDb.mockResolvedValue(db as never);
    const caller = appRouter.createCaller(createAuthedContext(1));
    await expect(caller.sharedWatchlists.extend({ token: "tok" })).rejects.toThrow(/NOT_FOUND|Share not found/);
  });

  it("extend requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.sharedWatchlists.extend({ token: "tok" })).rejects.toThrow();
  });
});
