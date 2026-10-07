import { describe, expect, it } from "vitest";
import { checkPriceAnomaly } from "../lib/alert-integrity";

describe("checkPriceAnomaly", () => {
  it("flags a price far below the history median", () => {
    const r = checkPriceAnomaly(29, [100, 100, 100, 100]);
    expect(r.suspicious).toBe(true);
    expect(r.reason).toBe("far_below_history");
  });

  it("flags a price far above the history median", () => {
    const r = checkPriceAnomaly(600, [100, 100, 100]);
    expect(r.suspicious).toBe(true);
    expect(r.reason).toBe("far_above_history");
  });

  it("does not flag a price within the band", () => {
    const r = checkPriceAnomaly(80, [100, 100, 100]);
    expect(r.suspicious).toBe(false);
  });

  it("never flags with fewer than 3 history points", () => {
    expect(checkPriceAnomaly(1, [100, 100]).suspicious).toBe(false);
    expect(checkPriceAnomaly(1, []).suspicious).toBe(false);
  });

  it("never flags a non-finite price or a non-positive median", () => {
    expect(checkPriceAnomaly(Number.NaN, [100, 100, 100]).suspicious).toBe(false);
    expect(checkPriceAnomaly(1, [0, 0, 0]).suspicious).toBe(false);
  });

  it("honors custom thresholds", () => {
    expect(checkPriceAnomaly(40, [100, 100, 100], { lowRatio: 0.5 }).suspicious).toBe(true);
    expect(checkPriceAnomaly(40, [100, 100, 100], { lowRatio: 0.3 }).suspicious).toBe(false);
  });

  it("treats the thresholds as exclusive (exactly at the ratio is not suspicious)", () => {
    // ratio === 0.3 (the default lowRatio) must NOT be suspicious.
    expect(checkPriceAnomaly(30, [100, 100, 100]).suspicious).toBe(false);
    // ratio === 5 (the default highRatio) must NOT be suspicious.
    expect(checkPriceAnomaly(500, [100, 100, 100]).suspicious).toBe(false);
  });
});
