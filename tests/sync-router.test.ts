import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
}));

vi.mock("../server/sync-db", () => ({
  listChangedItems: vi.fn(async () => []),
  upsertSyncItem: vi.fn(),
  purgeOldTombstones: vi.fn(),
  shouldAcceptSyncWrite: vi.fn(),
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
    loginMethod: "manus",
    role: "user",
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
    expect(result).toEqual({ accepted: 0, stamped: [] });
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
});
