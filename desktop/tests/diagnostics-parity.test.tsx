import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("desktop diagnostics parity", () => {
  it("Diagnostics page exists", () => {
    expect(read("src/pages/Diagnostics.tsx")).toContain("Diagnostics");
  });

  it("App registers /diagnostics route", () => {
    expect(read("src/App.tsx")).toContain("/diagnostics");
  });

  it("Settings links to diagnostics", () => {
    const src = read("src/pages/Settings.tsx");
    expect(src).toContain("diagnostics");
  });
});
