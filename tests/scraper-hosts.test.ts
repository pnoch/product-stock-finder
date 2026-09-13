import { describe, expect, it } from "vitest";
import { PARSERS } from "../lib/scrapers/registry";
import { geticParser } from "../lib/scrapers/getic";
import { gearupParser } from "../lib/scrapers/gearup";
import { flytecParser } from "../lib/scrapers/flytec";
import { DISTRIBUTORS } from "../shared/src/distributors";

function hostOf(url: string): string {
  return new URL(url).hostname;
}

describe("scraper hosts", () => {
  it("flytec scrapes the live flyteccomputers.com (not the dead domain)", () => {
    expect(hostOf(flytecParser.baseUrl)).toBe("flyteccomputers.com");
    expect(hostOf(flytecParser.buildSearchUrl("CRS326"))).toBe(
      "flyteccomputers.com",
    );
  });

  it("gearup scrapes canonical gear-up.me (gearup.me only redirects there)", () => {
    expect(hostOf(gearupParser.baseUrl)).toBe("gear-up.me");
    expect(hostOf(gearupParser.buildSearchUrl("CRS326"))).toBe("gear-up.me");
  });

  it("keeps the verified getic.gr regional storefront", () => {
    expect(hostOf(geticParser.baseUrl)).toBe("getic.gr");
  });

  it("every parser's search URL stays on its own baseUrl host", () => {
    for (const parser of PARSERS) {
      const base = hostOf(parser.baseUrl);
      const search = hostOf(parser.buildSearchUrl("CRS326-24S+2Q+RM"));
      expect(
        search,
        `${parser.id} search host ${search} !== base host ${base}`,
      ).toBe(base);
    }
  });

  it("every parser id maps to a catalog distributor", () => {
    const ids = new Set(DISTRIBUTORS.map((d) => d.id));
    for (const parser of PARSERS) {
      expect(ids.has(parser.id), `parser ${parser.id} missing catalog entry`).toBe(
        true,
      );
    }
  });
});
