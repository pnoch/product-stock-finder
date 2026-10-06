import { describe, expect, it } from "vitest";
import { formatEstimate } from "../lib/estimate-format";

describe("formatEstimate", () => {
  it("prefixes with ~ and suffixes with est.", () => {
    expect(formatEstimate(38, "USD")).toBe("~$38 est.");
  });

  it("uses the currency symbol", () => {
    expect(formatEstimate(38, "EUR")).toBe("~€38 est.");
  });

  it("rounds to whole units", () => {
    expect(formatEstimate(38.4, "USD")).toBe("~$38 est.");
    expect(formatEstimate(38.6, "USD")).toBe("~$39 est.");
  });

  it("handles zero", () => {
    expect(formatEstimate(0, "USD")).toBe("~$0 est.");
  });

  it("falls back to the code for an unknown currency", () => {
    expect(formatEstimate(38, "ZZZ")).toBe("~ZZZ 38 est.");
  });

  it("returns N/A for a non-finite amount", () => {
    expect(formatEstimate(Number.NaN, "USD")).toBe("N/A");
    expect(formatEstimate(Number.POSITIVE_INFINITY, "USD")).toBe("N/A");
  });

  it("does not add a space for a multi-char non-code symbol", () => {
    // MYR is "RM" (a real symbol, not a 3-letter code) — no space.
    expect(formatEstimate(38, "MYR")).toBe("~RM38 est.");
  });
});
