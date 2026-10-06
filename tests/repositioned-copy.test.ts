import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// Pins the repositioned positioning so a future edit can't silently revert it
// to generic price-tracker copy.
describe("repositioned copy", () => {
  it("mobile onboarding leads with find/landed/restock", () => {
    const src = read("components/onboarding/onboarding-screen.tsx");
    expect(src).toContain("Find It Anywhere");
    expect(src).toContain("Know the Real Price");
    expect(src).toContain("Never Miss a Restock");
  });

  it("mobile home uses the radar subtitle and empty state", () => {
    const src = read("app/(tabs)/index.tsx");
    expect(src).toContain("Find it anywhere. Landed to your door.");
    expect(src).toContain("Nothing on the radar yet");
  });

  it("About carries the tagline and origin line", () => {
    const src = read("components/settings/about-section.tsx");
    expect(src).toContain("Find it anywhere. Landed to your door.");
    expect(src).toContain("CRS804 during a global shortage");
  });

  it("desktop mirrors the onboarding + home copy", () => {
    expect(read("desktop/src/components/OnboardingModal.tsx")).toContain("Find It Anywhere");
    const home = read("desktop/src/pages/Home.tsx");
    expect(home).toContain("Find it anywhere. Landed to your door.");
    expect(home).toContain("Nothing on the radar yet");
  });

  it("pins the onboarding bodies on both platforms", () => {
    const mobile = read("components/onboarding/onboarding-screen.tsx");
    const desktop = read("desktop/src/components/OnboardingModal.tsx");
    for (const src of [mobile, desktop]) {
      expect(src).toContain("see who actually has it in stock");
      expect(src).toContain("No surprises at checkout");
      expect(src).toContain("the second it's back or cheaper");
    }
  });

  it("pins the repositioned store description and notification permission", () => {
    const config = read("app.config.ts");
    expect(config).toContain("Global stock & price radar for hard-to-find hardware");
    expect(config).toContain("alerts you the moment a watched part is back in stock");
    const notifications = read("lib/notifications.ts");
    expect(notifications).toContain("Alerts when a watched part restocks");
  });

  it("pins the watchlist empty state on both platforms", () => {
    expect(read("components/watchlist/empty-state.tsx")).toContain("alerting you the moment it's in stock or cheaper");
    expect(read("desktop/src/pages/Watchlist.tsx")).toContain("alerting you the moment it's in stock or cheaper");
  });
});
