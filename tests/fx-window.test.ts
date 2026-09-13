import { describe, expect, it } from "vitest";
import {
  getFxWindowChange,
  sliceFxHistoryByRange,
} from "../lib/fx-history";
import type { FxHistory } from "../lib/storage/fx-history";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-09-13T12:00:00Z");

function history(days: number[], rates: (number | null)[]): FxHistory {
  return {
    rates: { EUR: rates },
    timestamps: days.map((d) => NOW - d * DAY),
  };
}

describe("sliceFxHistoryByRange", () => {
  it("keeps only points inside the 7-day window, aligned", () => {
    const h = history([10, 6, 3, 0], [1.0, 1.05, 1.06, 1.1]);
    const sliced = sliceFxHistoryByRange(h, "1W");
    expect(sliced.timestamps).toHaveLength(3);
    expect(sliced.rates.EUR).toEqual([1.05, 1.06, 1.1]);
  });

  it("returns everything for All", () => {
    const h = history([60, 10, 0], [0.9, 1.0, 1.1]);
    const sliced = sliceFxHistoryByRange(h, "All");
    expect(sliced.timestamps).toHaveLength(3);
    expect(sliced.rates.EUR).toEqual([0.9, 1.0, 1.1]);
  });
});

describe("getFxWindowChange", () => {
  it("computes first-to-last change inside the window", () => {
    const h = history([10, 6, 3, 0], [1.0, 1.05, 1.06, 1.1]);
    const change = getFxWindowChange(h, "1W");
    // (1.1 - 1.05) / 1.05 * 100 ≈ 4.76 — the 10-day-old 1.0 must not leak in
    expect(change.EUR).toBeCloseTo(4.76, 1);
  });

  it("skips nulls when finding window endpoints", () => {
    const h = history([6, 3, 0], [null, 1.0, 1.05]);
    const change = getFxWindowChange(h, "1W");
    expect(change.EUR).toBeCloseTo(5.0, 1);
  });

  it("returns null when fewer than 2 valid points are in the window", () => {
    const h = history([30, 0], [1.0, 1.05]);
    const change = getFxWindowChange(h, "1W");
    expect(change.EUR).toBeNull();
  });
});
