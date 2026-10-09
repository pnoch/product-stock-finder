import { describe, expect, it } from "vitest";
import { isAcquired, activeProducts } from "../lib/acquired";
import type { Product } from "../lib/types";

const p = (id: string, acquiredAt?: string) => ({ id, acquiredAt }) as unknown as Product;

describe("acquired", () => {
  it("isAcquired is true only for a non-empty timestamp", () => {
    expect(isAcquired(p("a", "2026-01-01T00:00:00.000Z"))).toBe(true);
    expect(isAcquired(p("a"))).toBe(false);
    expect(isAcquired(p("a", ""))).toBe(false);
  });
  it("activeProducts drops acquired products", () => {
    const out = activeProducts([p("a", "2026-01-01T00:00:00.000Z"), p("b")]);
    expect(out.map((x) => x.id)).toEqual(["b"]);
  });
});
