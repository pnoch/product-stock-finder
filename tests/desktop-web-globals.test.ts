import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

// The desktop web bundle runs in a plain browser with no Node globals and
// no Metro shims. Bare `process.env` or `__DEV__` references crash the whole
// app on load (blank page). These guards failed silently until a real
// headless-Chromium smoke test caught them.
describe("desktop web-bundle globals", () => {
  it("constants/oauth.ts uses only static, inlinable env access", async () => {
    const text = await readFile("constants/oauth.ts", "utf8");
    // Expo only inlines literal `process.env.EXPO_PUBLIC_*` member expressions;
    // computed access (`process.env[key]`) is left as a runtime reference and
    // crashes the browser bundle. `import.meta` is also unsupported by Hermes.
    expect(text).not.toContain("import.meta");
    expect(text).not.toMatch(/process\.env\[/);
    expect(text).toContain("process.env.EXPO_PUBLIC_API_BASE_URL");
  });

  it("vite defines __DEV__ for shared React Native modules", async () => {
    const text = await readFile("desktop/vite.config.ts", "utf8");
    expect(text).toContain("__DEV__");
    expect(text).toContain("import.meta.env.DEV");
  });
});
