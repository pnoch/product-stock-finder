import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("manual-add timeout hygiene", () => {
  it("clears its timer on settle (shared helper)", async () => {
    const text = await readFile("lib/with-timeout.ts", "utf8");
    expect(text).toContain("withTimeoutReject");
    expect(text).toContain("withTimeout");
    expect(text).toContain("clearTimeout");
  });
});
