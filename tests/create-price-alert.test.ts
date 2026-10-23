import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  permission: true,
  addResult: true,
  addThrows: false,
  scheduleResult: "notification-1" as string | null,
  scheduleThrows: false,
  added: [] as unknown[],
}));

vi.mock("@/lib/storage", () => ({
  addAlert: vi.fn(async (alert: unknown) => {
    if (state.addThrows) throw new Error("quota");
    if (state.addResult) state.added.push(alert);
    return state.addResult;
  }),
}));

vi.mock("@/lib/notifications", () => ({
  ensureNotificationPermission: vi.fn(async () => state.permission),
  schedulePriceAlert: vi.fn(async () => {
    if (state.scheduleThrows) throw new Error("scheduler");
    return state.scheduleResult;
  }),
}));

import { createPriceAlert } from "../lib/create-price-alert";

const input = {
  productId: "p1",
  productName: "Test Product",
  targetPrice: 100,
  currency: "USD",
  distributorId: "dist-1",
};

describe("createPriceAlert", () => {
  beforeEach(() => {
    state.permission = true;
    state.addResult = true;
    state.addThrows = false;
    state.scheduleResult = "notification-1";
    state.scheduleThrows = false;
    state.added = [];
  });

  it("saves then schedules and returns both flags", async () => {
    const result = await createPriceAlert(input);
    expect(result.saved).toBe(true);
    expect(result.scheduled).toBe(true);
    expect(result.alert?.id).toBe(
      "alert-p1-dist-1-drop-100-USD",
    );
    expect(state.added).toHaveLength(1);
  });

  it("does not write an alert when permission is denied", async () => {
    state.permission = false;
    const result = await createPriceAlert(input);
    expect(result).toEqual({
      saved: false,
      scheduled: false,
      reason: "permission",
    });
    expect(state.added).toHaveLength(0);
  });

  it("keeps the saved alert when scheduling fails", async () => {
    state.scheduleThrows = true;
    const result = await createPriceAlert(input);
    expect(result.saved).toBe(true);
    expect(result.scheduled).toBe(false);
    expect(state.added).toHaveLength(1);
  });

  it("reports a duplicate without scheduling again", async () => {
    state.addResult = false;
    const result = await createPriceAlert(input);
    expect(result).toEqual({
      saved: false,
      scheduled: false,
      reason: "duplicate",
    });
  });

  it("reports a save failure without scheduling", async () => {
    state.addThrows = true;
    const result = await createPriceAlert(input);
    expect(result).toEqual({
      saved: false,
      scheduled: false,
      reason: "save_failed",
    });
  });

  it("uses a deterministic id for the same target", async () => {
    const first = await createPriceAlert(input);
    const second = await createPriceAlert(input);
    expect(first.alert?.id).toBe(second.alert?.id);
  });
});
