import { afterEach, describe, expect, it } from "vitest";
import {
  FREE_WATCHLIST_LIMIT,
  canAddToWatchlist,
  isProFeature,
  shouldEnforceFreeLimits,
} from "../lib/pro-features";
import { setEntitlementProvider } from "../lib/entitlements";

describe("pro features", () => {
  afterEach(() => {
    setEntitlementProvider(null);
  });

  it("free users can add up to the limit", () => {
    expect(FREE_WATCHLIST_LIMIT).toBe(5);
    expect(canAddToWatchlist(0, false)).toBe(true);
    expect(canAddToWatchlist(4, false)).toBe(true);
    expect(canAddToWatchlist(5, false)).toBe(false);
    expect(canAddToWatchlist(6, false)).toBe(false);
  });

  it("pro users have no limit", () => {
    expect(canAddToWatchlist(5, true)).toBe(true);
    expect(canAddToWatchlist(999, true)).toBe(true);
  });

  it("classifies each feature", () => {
    expect(isProFeature("unlimited_watchlist")).toBe(true);
    expect(isProFeature("background_monitoring")).toBe(true);
    expect(isProFeature("digests")).toBe(true);
    expect(isProFeature("server_sync")).toBe(true);
    expect(isProFeature("bulk_import")).toBe(true);
    expect(isProFeature("landed_cost_sourcing")).toBe(true);
    expect(isProFeature("not_a_feature")).toBe(false);
  });

  // Without a billing provider the SEED_IDS (7) exceed FREE_WATCHLIST_LIMIT (5),
  // so enforcing the limit would block every new install before it could add
  // anything. Enforcement must therefore be off until a provider can sell Pro.
  it("does not enforce free limits when no provider is registered", () => {
    setEntitlementProvider(null);
    expect(shouldEnforceFreeLimits()).toBe(false);
  });

  it("does not enforce free limits for a provider without purchase", () => {
    setEntitlementProvider({ getState: async () => ({ tier: "free", isPro: false }) });
    expect(shouldEnforceFreeLimits()).toBe(false);
  });

  it("enforces free limits once a provider can sell Pro", () => {
    setEntitlementProvider({
      getState: async () => ({ tier: "free", isPro: false }),
      purchase: async () => ({ tier: "pro", isPro: true }),
    });
    expect(shouldEnforceFreeLimits()).toBe(true);
  });
});
