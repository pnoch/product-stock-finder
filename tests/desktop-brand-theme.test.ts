import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop brand theme tokens", () => {
  it("defines every brand shade used across desktop components", async () => {
    const css = await readFile("desktop/src/styles/globals.css", "utf8");
    for (const shade of ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"]) {
      expect(css).toContain(`--color-brand-${shade}`);
    }
  });
});
