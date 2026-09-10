import { describe, expect, it, vi } from "vitest";
import { PARSERS } from "../lib/scrapers/registry";

vi.mock("../lib/scrapers/resilient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/scrapers/resilient")>();
  return {
    ...actual,
    resilientFetch: vi.fn().mockResolvedValue({ status: "ok", html: "<html>probe</html>" }),
  };
});

import { checkAllDistributors } from "../server/health";

describe("checkAllDistributors", () => {
  it("returns one shaped entry per parser", async () => {
    const results = await checkAllDistributors();
    expect(results).toHaveLength(PARSERS.length);
    for (const r of results) {
      expect(typeof r.distributorId).toBe("string");
      expect(["working", "blocked", "error"]).toContain(r.status);
      expect(Number.isNaN(Date.parse(r.lastChecked))).toBe(false);
    }
  });
});
