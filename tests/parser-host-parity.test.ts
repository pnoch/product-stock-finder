import { describe, expect, it } from "vitest";
import { PARSERS } from "../lib/scrapers/registry";
import { DISTRIBUTORS } from "../shared/src/distributors";

// Guards the class of bug where a parser's base URL drifts from the
// distributor's real website (dead/parked domains), which silently disables
// that distributor forever.
describe("parser base URLs match the distributor website host", () => {
  const byId = new Map(DISTRIBUTORS.map((d) => [d.id, d]));

  it("every parser's base host matches its distributor website host", () => {
    for (const parser of PARSERS) {
      const dist = byId.get(parser.id);
      if (!dist?.website) continue;
      const norm = (u: string) => new URL(u).hostname.replace(/^www\./, "");
      expect(norm(parser.baseUrl), parser.id).toBe(norm(dist.website));
    }
  });

  it("every parser's search URL stays on its base host", () => {
    for (const parser of PARSERS) {
      const norm = (u: string) => new URL(u).hostname.replace(/^www\./, "");
      expect(
        norm(parser.buildSearchUrl("CRS326-24S+2Q+RM")),
        parser.id,
      ).toBe(norm(parser.baseUrl));
    }
  });
});
