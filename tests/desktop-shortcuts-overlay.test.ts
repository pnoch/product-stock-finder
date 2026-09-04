import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop shortcuts overlay hooks", () => {
  it("calls hooks before the closed early return", async () => {
    const text = await readFile("desktop/src/App.tsx", "utf8");
    const componentStart = text.indexOf("function ShortcutsOverlay(");
    expect(componentStart).toBeGreaterThanOrEqual(0);
    const body = text.slice(componentStart);
    const earlyReturn = body.indexOf("if (!open) return null;");
    const effect = body.indexOf("useEffect(() => {");
    expect(earlyReturn).toBeGreaterThanOrEqual(0);
    expect(effect).toBeGreaterThanOrEqual(0);
    expect(effect).toBeLessThan(earlyReturn);
  });
});
