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
});
