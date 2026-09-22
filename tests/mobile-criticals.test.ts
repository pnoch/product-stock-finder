import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

describe("mobile release blockers", () => {
  it("has exactly one shared-watchlist route", () => {
    const candidates = ["app/w/[token].tsx", "app/(tabs)/w/[token].tsx"].filter((file) =>
      existsSync(path.join(process.cwd(), file)),
    );
    expect(candidates).toHaveLength(1);
  });

  // The server's NOT_FOUND message is literally "Share not found", so rendering
  // `query.error.message` under a "Share not found" heading printed the same
  // sentence twice (verified on device). The screen must substitute an
  // actionable subtitle when the message just repeats the title.
  it("does not repeat the share-not-found heading as its own subtitle", () => {
    const src = readFileSync(path.join(process.cwd(), "app/w/[token].tsx"), "utf8");
    expect(src).not.toMatch(/\{query\.error\.message\}/);
    expect(src).toContain("This link may have expired, been revoked, or never existed.");
  });
});
