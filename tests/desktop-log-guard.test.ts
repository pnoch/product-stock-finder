import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop shared logger", () => {
  it("imports LOG_ERROR from the shared module", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("../../../lib/log");
    expect(text).not.toContain("const LOG_ERROR =");
  });
});
