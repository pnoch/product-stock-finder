import { describe, expect, it, vi, beforeEach } from "vitest";

const whereCalls: unknown[] = [];
let deleteResults: unknown[] = [];
const dbStub = {
  delete: vi.fn(() => ({
    where: vi.fn((cond: unknown) => {
      whereCalls.push(cond);
      return { limit: vi.fn(async () => deleteResults.shift() ?? [{ affectedRows: 0 }, []]) };
    }),
  })),
};

vi.mock("../server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/db")>();
  return { ...actual, getDb: vi.fn(async () => dbStub) };
});

import { purgeOldRevokedDevices } from "../server/devices";

describe("purgeOldRevokedDevices drains in batches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    whereCalls.length = 0;
    deleteResults = [];
  });

  it("keeps deleting while full batches are returned", async () => {
    // Two full batches then a partial one → 3 delete calls.
    deleteResults = [
      [{ affectedRows: 1000 }, []],
      [{ affectedRows: 1000 }, []],
      [{ affectedRows: 5 }, []],
    ];
    await purgeOldRevokedDevices(Date.now());
    expect(dbStub.delete).toHaveBeenCalledTimes(3);
  });

  it("stops after one batch when fewer than the batch size are removed", async () => {
    deleteResults = [[{ affectedRows: 3 }, []]];
    await purgeOldRevokedDevices(Date.now());
    expect(dbStub.delete).toHaveBeenCalledTimes(1);
  });
});
