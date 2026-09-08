import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop safety and charts", () => {
  it("gates account deletion on typed confirmation", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("deleteConfirmEmail");
    expect(text).toContain("Yes, delete everything");
  });

  it("navigates tour slides from anywhere in the dialog", async () => {
    const text = await readFile("desktop/src/components/OnboardingModal.tsx", "utf8");
    expect(text).toContain("onKeyDown");
    expect(text).not.toContain('aria-label="Tour steps"\n          onKeyDown');
  });

  it("labels charts for screen readers", async () => {
    const compare = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    const detail = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    const rates = await readFile("desktop/src/pages/Rates.tsx", "utf8");
    expect(compare).toContain("Price history,");
    expect(detail).toContain('role="img"');
    expect(rates).toContain('role="img"');
  });
});
