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

  it("scrapes the live getic.com storefront (getic.gr redirects to a 403)", () => {
    expect(hostOf(geticParser.baseUrl)).toBe("getic.com");
  });

  it("scrapes the live hosts for the previously-dead domains", () => {
    // These hosts were NXDOMAIN/parked; the real storefronts are:
    const expected: Record<string, string> = {
      "rocnoc-us": "www.roc-noc.com",
      "linktechs-us": "shop.linktechs.net",
      "networkdevices-us": "networkdevicesinc.com",
      "100mega-cz": "b2b.100mega.com",
      "multilink-us": "shop.multilink.us",
    };
    for (const [id, host] of Object.entries(expected)) {
      const parser = PARSERS.find((p) => p.id === id)!;
      expect(hostOf(parser.baseUrl), id).toBe(host);
    }
  });

  it("every parser's search URL stays on its own baseUrl host", () => {
    for (const parser of PARSERS) {
      const base = hostOf(parser.baseUrl).replace(/^www\./, "");
      const search = hostOf(parser.buildSearchUrl("CRS326-24S+2Q+RM")).replace(
        /^www\./,
        "",
      );
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
