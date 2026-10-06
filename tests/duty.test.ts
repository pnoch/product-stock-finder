import { describe, expect, it } from "vitest";
import { estimateImportDuty } from "../shared/src/duty";

describe("estimateImportDuty", () => {
  it("returns a VAT rate for a known country", () => {
    const est = estimateImportDuty(100, "Networking Switch", "TH");
    expect(est).not.toBeNull();
    expect(est!.vatRate).toBeGreaterThan(0);
    expect(est!.dutyRate).toBeGreaterThanOrEqual(0);
  });

  it("returns null for an unknown country", () => {
    expect(estimateImportDuty(100, "Networking Switch", "ZZ")).toBeNull();
  });

  it("returns zero VAT for a zero-VAT country", () => {
    const est = estimateImportDuty(100, "Networking Switch", "US");
    expect(est!.vatRate).toBe(0);
  });

  it("never returns a negative rate", () => {
    for (const cc of ["TH", "DE", "GB", "AU", "US", "MY"]) {
      const est = estimateImportDuty(100, "Router", cc);
      if (est) {
        expect(est.vatRate).toBeGreaterThanOrEqual(0);
        expect(est.dutyRate).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
