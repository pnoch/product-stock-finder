import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PARSERS } from "../../lib/scrapers/registry";
import { DISTRIBUTORS } from "@shared/distributors";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

// One fixture per distributor, named `<distributorId>-<region>.html`.
function fixtureFor(distributorId: string): string | null {
  const match = fs
    .readdirSync(FIXTURES_DIR)
    .find((f) => f === `${distributorId}.html` || f.startsWith(`${distributorId}-`));
  if (!match) return null;
  return fs.readFileSync(path.join(FIXTURES_DIR, match), "utf-8");
}

// AGENTS.md: every parser MUST thread the requested model through
// `parsePrice(html, model?)` and gate on `modelMismatch` so a wrong-product
// search result is rejected as a miss. A fixture is a real page for the
// distributor's own product, so asking for a model that cannot appear on it must
// yield null — otherwise the parser would report another product's price.
describe("parser model-gate conformance", () => {
  const registered = PARSERS.map((p) => p.id);
  const withFixtures = DISTRIBUTORS.filter((d) => fixtureFor(d.id) !== null);

  it("has a fixture for every registered parser", () => {
    // If a parser is added without a fixture the sweep silently stops covering
    // it, so this is exact rather than a floor.
    expect(withFixtures.map((d) => d.id).sort()).toEqual(
      PARSERS.map((p) => p.id).sort(),
    );
  });

  for (const distributor of withFixtures) {
    const parser = PARSERS.find((p) => p.id === distributor.id);
    if (!parser) continue;
    it(`${distributor.id} rejects a mismatch instead of reporting another product's price`, () => {
      const html = fixtureFor(distributor.id)!;
      const result = parser.parsePrice(html, "__NO_SUCH_MODEL__");
      expect(result).toBeNull();
    });
  }

  it("covers every registered parser id", () => {
    for (const id of registered) {
      expect(DISTRIBUTORS.some((d) => d.id === id)).toBe(true);
    }
  });
});
