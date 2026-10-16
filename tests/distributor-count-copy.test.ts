import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DISTRIBUTORS } from "@shared/distributors";

const FILES = [
  "app/(tabs)/index.tsx",
  "components/watchlist/empty-state.tsx",
  "components/onboarding/onboarding-screen.tsx",
  "desktop/src/pages/Home.tsx",
  "desktop/src/pages/Watchlist.tsx",
  "desktop/src/components/OnboardingModal.tsx",
];

describe("distributor-count copy", () => {
  it("derives the count from DISTRIBUTORS instead of a stale literal", () => {
    for (const file of FILES) {
      const src = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(src, file).toContain("DISTRIBUTORS.length");
      expect(src, file).not.toMatch(/\b25 (global )?distributors/);
    }
  });

  it("tracks more than the old hardcoded 25", () => {
    expect(DISTRIBUTORS.length).toBeGreaterThan(25);
  });
});
