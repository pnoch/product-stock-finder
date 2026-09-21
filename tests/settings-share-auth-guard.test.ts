import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

// Device QA found that tapping "Share watchlist" while signed out surfaced the
// raw server error "Please login (10001)" — the endpoint is sign-in only, but
// the button called it unconditionally. It must instead offer a way to sign in
// (the desktop Settings screen already guards on isAuthenticated).

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("settings share-watchlist auth guard", () => {
  it("prompts sign-in instead of calling the endpoint when signed out", async () => {
    const src = stripComments(
      await readFile("app/(tabs)/settings.tsx", "utf8"),
    );
    const start = src.indexOf("function ShareWatchlistButton");
    expect(start).toBeGreaterThan(-1);
    const handler = src.slice(start, start + 1600);
    // Must check auth before mutating.
    expect(handler).toMatch(/if \(!isAuthenticated\)/);
    expect(handler).toMatch(/Sign in to share/);
    // And the guard must precede the mutation call.
    expect(handler.indexOf("!isAuthenticated")).toBeLessThan(
      handler.indexOf("mutateAsync"),
    );
  });

  it("passes auth state and the sign-in handler into the button", async () => {
    const src = stripComments(
      await readFile("app/(tabs)/settings.tsx", "utf8"),
    );
    expect(src).toMatch(
      /<ShareWatchlistButton isAuthenticated=\{isAuthenticated\} onSignIn=\{handleSignIn\}/,
    );
  });
});
