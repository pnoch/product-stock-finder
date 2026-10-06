import { describe, expect, it, afterEach } from "vitest";
import {
  FREE_STATE,
  getEntitlementProvider,
  getEntitlementState,
  setEntitlementProvider,
} from "../lib/entitlements";

afterEach(() => setEntitlementProvider(null));

describe("entitlements", () => {
  it("defaults to free with no provider", async () => {
    expect(getEntitlementProvider()).toBeNull();
    expect(await getEntitlementState()).toEqual(FREE_STATE);
    expect(FREE_STATE.isPro).toBe(false);
  });

  it("returns the registered provider's state", async () => {
    setEntitlementProvider({
      getState: async () => ({ tier: "pro", isPro: true }),
    });
    expect(await getEntitlementState()).toEqual({ tier: "pro", isPro: true });
  });

  it("falls back to free when the provider throws (fail closed)", async () => {
    setEntitlementProvider({
      getState: async () => {
        throw new Error("network");
      },
    });
    expect(await getEntitlementState()).toEqual(FREE_STATE);
  });

  it("resets to free when the provider is cleared", async () => {
    setEntitlementProvider({ getState: async () => ({ tier: "pro", isPro: true }) });
    setEntitlementProvider(null);
    expect(await getEntitlementState()).toEqual(FREE_STATE);
  });
});
