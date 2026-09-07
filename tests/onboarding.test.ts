import { describe, expect, it, vi } from "vitest";
import { hasSeenOnboarding, setOnboardingSeen } from "../lib/onboarding";

function mockStore(initial: string | null = null) {
  const store: Record<string, string | null> = { has_seen_onboarding: initial };
  return {
    getItem: vi.fn(async (key: string) => store[key] ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
  };
}

describe("hasSeenOnboarding", () => {
  it("returns false when never set", async () => {
    expect(await hasSeenOnboarding(mockStore())).toBe(false);
  });

  it("returns true when set", async () => {
    expect(await hasSeenOnboarding(mockStore("true"))).toBe(true);
  });

  it("returns true on store error (treat broken storage as seen, never nag)", async () => {
    const bad = { getItem: vi.fn(async () => { throw new Error("fail"); }), setItem: vi.fn() };
    expect(await hasSeenOnboarding(bad)).toBe(true);
  });
});

describe("setOnboardingSeen", () => {
  it("stores 'true'", async () => {
    const store = mockStore();
    await setOnboardingSeen(store);
    expect(store.setItem).toHaveBeenCalledWith("has_seen_onboarding", "true");
  });

  it("swallows store errors", async () => {
    const bad = { getItem: vi.fn(), setItem: vi.fn(async () => { throw new Error("fail"); }) };
    await expect(setOnboardingSeen(bad)).resolves.toBeUndefined();
  });
});
