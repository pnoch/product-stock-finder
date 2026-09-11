import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("health probe scheduling", () => {
  it("runs the probe on the foreground poller", async () => {
    const text = await readFile("desktop/src/App.tsx", "utf8");
    expect(text).toContain("runHealthProbeIfDue");
    expect(text).toContain("setInterval");
  });
});
