import { describe, expect, it } from "vitest";
import { SYNC_COLLECTION_ORDER } from "../server/sync-db";

// The cursor comparison in sync-db.ts and the page sort in routers.ts must use
// the SAME collection order, or a page boundary can skip rows in a collection
// that sorts earlier lexicographically but later in the canonical order.
describe("sync collection order is canonical, not lexicographic", () => {
  it("is not sorted lexicographically (which would make the two orders differ)", () => {
    const lexicographic = [...SYNC_COLLECTION_ORDER].sort();
    expect([...SYNC_COLLECTION_ORDER]).not.toEqual(lexicographic);
  });

  it("contains every sync collection exactly once", () => {
    expect(new Set(SYNC_COLLECTION_ORDER).size).toBe(
      SYNC_COLLECTION_ORDER.length,
    );
    for (const c of ["watchlist", "alerts", "reminders", "settings"]) {
      expect(SYNC_COLLECTION_ORDER).toContain(c);
    }
  });
});
