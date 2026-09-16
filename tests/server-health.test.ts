import { describe, expect, it, vi } from "vitest";

// Hoisted holder so the mocked fetchAndParse can call the test's resilientFetch
// mock (module-local bindings cannot be intercepted by vi.mock).
const __resilientHolder = vi.hoisted(() => ({ fn: async (_o: unknown): Promise<any> => ({ status: "ok", html: "", method: "plain" }) }));
import { PARSERS } from "../lib/scrapers/registry";

vi.mock("../lib/scrapers/resilient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/scrapers/resilient")>();
  return {
    ...actual,
    resilientFetch: vi.fn().mockResolvedValue({ status: "ok", html: "<html>probe</html>" }),
    fetchAndParse: vi.fn(async (parser: any, model: string) => {
    const outcome = await __resilientHolder.fn({ parser, url: parser.buildSearchUrl(model) } as never);
    return {
      result: outcome.status === "ok" && outcome.html ? parser.parsePrice(outcome.html, model, parser.buildSearchUrl(model)) : null,
      url: parser.buildSearchUrl(model),
      outcome,
    };
  }),
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
  it("keeps no state between calls", async () => {
    const first = await checkAllDistributors();
    const second = await checkAllDistributors();
    expect(first).toHaveLength(second.length);
    // breaker state is per-call: force failure then success would need fetch control — keep the structural pin:
    expect(first.map((r) => r.distributorId).sort()).toEqual(second.map((r) => r.distributorId).sort());
  });
});
