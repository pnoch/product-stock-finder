import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// `id` comes from the route, so navigating between two distributors re-runs the
// load while the previous one is in flight; the older result could land last and
// show the wrong distributor's samples (the same bug fixed on mobile).
describe("desktop health detail load guard", () => {
  it("guards both awaits against an out-of-order result", () => {
    const src = readFileSync(
      join(__dirname, "..", "src", "pages", "HealthDetail.tsx"),
      "utf8",
    );
    expect(src).toContain("loadGenRef");
    // Both awaits (history + status) must be guarded.
    expect(src.split("if (gen !== loadGenRef.current) return;").length - 1).toBe(
      3,
    );
  });
});
