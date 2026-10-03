import { describe, expect, it } from "vitest";
import { computeAlertMutations } from "../src/lib/alert-mutations";

describe("computeAlertMutations", () => {
  it("patches only the changed fields", () => {
    const last = [{ id: "a1", targetPrice: 500, isActive: true, snoozedUntil: null }];
    const next = [{ id: "a1", targetPrice: 450, isActive: true, snoozedUntil: null }];
    expect(computeAlertMutations(last, next)).toEqual({
      upserts: [{ id: "a1", patch: { targetPrice: 450 } }],
      removes: [],
    });
  });

  it("sends null to clear a removed field (re-arm)", () => {
    const last = [{ id: "a1", isActive: false, triggeredAt: "2026-06-02T00:00:00.000Z" }];
    const next = [{ id: "a1", isActive: true }];
    expect(computeAlertMutations(last, next)).toEqual({
      upserts: [{ id: "a1", patch: { isActive: true, triggeredAt: null } }],
      removes: [],
    });
  });

  it("sends a full item for an add and lists removals", () => {
    const last = [{ id: "gone", targetPrice: 1 }];
    const next = [{ id: "new", targetPrice: 2, currency: "USD" }];
    expect(computeAlertMutations(last, next)).toEqual({
      upserts: [{ id: "new", patch: { targetPrice: 2, currency: "USD" } }],
      removes: ["gone"],
    });
  });

  it("is a no-op when nothing changed", () => {
    const same = [{ id: "a1", targetPrice: 500 }];
    expect(computeAlertMutations(same, structuredClone(same))).toEqual({
      upserts: [],
      removes: [],
    });
  });
});
