import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop service worker", () => {
  it("handles push and notificationclick without app-specific precache", async () => {
    const text = await readFile("desktop/public/sw.js", "utf8");
    expect(text).toContain('addEventListener("push"');
    expect(text).toContain('addEventListener("notificationclick"');
    expect(text).toContain("showNotification");
    expect(text).not.toContain("precache");
    expect(text).not.toContain("_expo");
  });
});
