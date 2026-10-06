import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop onboarding", () => {
  it("has a 3-slide welcome modal", async () => {
    const text = await readFile("desktop/src/components/OnboardingModal.tsx", "utf8");
    expect(text).toContain("Find It Anywhere");
    expect(text).toContain("Know the Real Price");
    expect(text).toContain("Never Miss a Restock");
  });

  it("shows once via shared seen-flag helpers", async () => {
    const app = await readFile("desktop/src/App.tsx", "utf8");
    const modal = await readFile("desktop/src/components/OnboardingModal.tsx", "utf8");
    expect(app).toContain("OnboardingModal");
    expect(modal).toContain("hasSeenOnboarding");
    expect(modal).toContain("setOnboardingSeen");
  });
});
