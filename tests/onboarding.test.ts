import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  hasSeenOnboarding,
  isPublicRoute,
  setOnboardingSeen,
} from "../lib/onboarding";

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

// The root layout renders the onboarding carousel for every route until the
// tour is completed, so a first-time visitor to /privacy (required by the App
// Store and Play Store) or an emailed verify/reset link only ever saw the tour.
// Verified on device: opening localhost:3000/privacy in a fresh browser showed
// the carousel; the policy only appeared after tapping Skip.
describe("isPublicRoute", () => {
  it.each([
    "/privacy",
    "/verify-email",
    "/reset-password",
    "/reset",
    "/oauth/callback",
    "/w/abc123",
  ])("treats %s as public", (path) => {
    expect(isPublicRoute(path)).toBe(true);
  });

  it("ignores query strings, hashes and trailing slashes", () => {
    expect(isPublicRoute("/privacy?utm=1")).toBe(true);
    expect(isPublicRoute("/reset-password?token=abc#top")).toBe(true);
    expect(isPublicRoute("/privacy/")).toBe(true);
  });

  it.each(["/", "/stats", "/product/123", "/health", "/wxyz"])(
    "treats %s as gated",
    (path) => {
      expect(isPublicRoute(path)).toBe(false);
    },
  );

  it("treats a missing pathname as gated", () => {
    expect(isPublicRoute(null)).toBe(false);
    expect(isPublicRoute(undefined)).toBe(false);
    expect(isPublicRoute("")).toBe(false);
  });
});

// A pure `isPublicRoute` unit test would still pass if the root layout stopped
// calling it, so guard the wiring too.
describe("root layout gates onboarding on public routes", () => {
  const src = readFileSync(join(__dirname, "..", "app/_layout.tsx"), "utf8");

  it("imports and evaluates isPublicRoute from the current pathname", () => {
    expect(src).toContain("isPublicRoute");
    expect(src).toMatch(/usePathname\(\)/);
    expect(src).toMatch(/const isPublic = isPublicRoute\(pathname\)/);
  });

  it("only renders the spinner and the tour for non-public routes", () => {
    expect(src).toMatch(/onboardingState === "checking" && !isPublic/);
    expect(src).toMatch(/onboardingState === "intro" && !isPublic/);
  });
});
