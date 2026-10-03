import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { appleAppSiteAssociation } from "../server/spa";

const APP_DIR = path.join(__dirname, "..", "app");

// Route patterns Expo Router can serve, derived from the filesystem:
//   app/stats.tsx            -> /stats
//   app/product/[id].tsx     -> /product/*
//   app/oauth/callback.tsx   -> /oauth/callback (+ /oauth/* below)
// `_`-prefixed files (partials/private routes) and `(group)` directories are
// excluded from the path, matching Expo Router's behaviour.
function routePatterns(dir = APP_DIR, prefix = ""): Set<string> {
  const out = new Set<string>();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = entry.name;
    if (name.startsWith("_")) continue;
    if (entry.isDirectory()) {
      const next = name.startsWith("(") ? prefix : `${prefix}/${name}`;
      for (const p of routePatterns(path.join(dir, name), next)) out.add(p);
      continue;
    }
    if (!name.endsWith(".tsx")) continue;
    const base = name.replace(/\.tsx$/, "");
    if (base.startsWith("[")) out.add(`${prefix}/*`);
    else if (base === "index") out.add(prefix === "" ? "/" : prefix);
    else out.add(`${prefix}/${base}`);
  }
  // A directory with any route can also be hit with an arbitrary child (its own
  // 404 page), which is what a trailing /* association means.
  for (const p of [...out]) {
    const slash = p.lastIndexOf("/");
    if (slash > 0) out.add(`${p.slice(0, slash)}/*`);
  }
  return out;
}

describe("universal-link paths match the router", () => {
  const previous = process.env.APPLE_TEAM_ID;

  beforeEach(() => {
    process.env.APPLE_TEAM_ID = "TEAMID1234";
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.APPLE_TEAM_ID;
    else process.env.APPLE_TEAM_ID = previous;
  });

  it("associates only paths the app can actually route", () => {
    const doc = appleAppSiteAssociation();
    expect(doc).not.toBeNull();
    const details = (
      doc as {
        applinks: { details: { components: { "/": string }[] }[] };
      }
    ).applinks.details;
    const linked = details.flatMap((d) => d.components.map((c) => c["/"]));
    expect(linked.length).toBeGreaterThan(5);

    const patterns = routePatterns();
    for (const link of linked) {
      // Without this, a renamed/removed route keeps its OS association and the
      // link opens the browser instead of the app — with no test failure.
      expect(patterns.has(link), `${link} has no matching route in app/`).toBe(
        true,
      );
    }
  });
});
