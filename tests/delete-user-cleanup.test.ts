import { describe, expect, it, vi, beforeEach } from "vitest";

// Self-mocking ../server/db cannot intercept deleteUserById's internal getDb
// call (ESM closure over the module-local binding), so mock one layer down:
// mysql2/promise (pool) + drizzle-orm/mysql2 (drizzle client) so the real
// getDb() returns a fake db whose first delete().where() rejects (revoked
// devices cleanup) and second resolves (users delete). Call order distinguishes
// the tables — robust without drizzle table internals.
let deleteCall = 0;

vi.mock("mysql2/promise", () => ({
  default: {
    createPool: vi.fn(() => ({ end: vi.fn(async () => {}) })),
  },
}));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => ({
    // Device-id lookups (select) return none, so the label cleanup is skipped.
    select: () => ({
      from: () => ({ where: async () => [] }),
    }),
    delete: (_table: unknown) => {
      deleteCall += 1;
      const call = deleteCall;
      return {
        where: async () => {
          // First delete is the revoked-devices cleanup; make it fail to
          // exercise the error path.
          if (call === 1) throw new Error("boom");
          return [];
        },
      };
    },
  })),
}));

import { deleteUserById, closeDb } from "../server/db";

beforeEach(async () => {
  deleteCall = 0;
  await closeDb();
  process.env.DATABASE_URL = "mysql://test:test@localhost:3306/test";
});

describe("deleteUserById", () => {
  it("logs revocation cleanup failure and still deletes the user", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await deleteUserById(1);
      expect(err).toHaveBeenCalledWith(
        expect.stringContaining("[Database]"),
        expect.anything(),
        expect.anything()
      );
      // revoked_devices cleanup (fails) + users delete.
      expect(deleteCall).toBe(2);
    } finally {
      err.mockRestore();
      delete process.env.DATABASE_URL;
      await closeDb();
    }
  });
});
