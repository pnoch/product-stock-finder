import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

// The desktop web bundle runs in a plain browser with no Node globals and
// no Metro shims. Bare `process.env` or `__DEV__` references crash the whole
// app on load (blank page). These guards failed silently until a real
// headless-Chromium smoke test caught them.
describe("desktop web-bundle globals", () => {
  it("constants/oauth.ts guards process access", async () => {
    const text = await readFile("constants/oauth.ts", "utf8");
    expect(text).toContain("typeof process");
    // No bare process.env outside the guard.
    const bare = text
      .split("\n")
      .filter(
        (line) =>
          /[^_.a-zA-Z]process\./.test(line) && !line.includes("typeof process"),
      );
    expect(bare).toEqual([]);
  });

  it("vite defines __DEV__ for shared React Native modules", async () => {
    const text = await readFile("desktop/vite.config.ts", "utf8");
    expect(text).toContain("__DEV__");
    expect(text).toContain("import.meta.env.DEV");
  });
});
