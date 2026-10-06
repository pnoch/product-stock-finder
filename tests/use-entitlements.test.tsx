// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { setEntitlementProvider } from "../lib/entitlements";
import { useEntitlements } from "../hooks/use-entitlements";

afterEach(() => setEntitlementProvider(null));

describe("useEntitlements", () => {
  it("defaults to free", async () => {
    const { result } = renderHook(() => useEntitlements());
    await waitFor(() => expect(result.current.isPro).toBe(false));
  });

  it("reflects a pro provider", async () => {
    setEntitlementProvider({ getState: async () => ({ tier: "pro", isPro: true }) });
    const { result } = renderHook(() => useEntitlements());
    await waitFor(() => expect(result.current.isPro).toBe(true));
  });
});
