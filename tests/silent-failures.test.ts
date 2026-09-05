import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("silent failures", () => {
  it("keeps secrets and bare console calls out of auth.ts", async () => {
    const text = await readFile("lib/_core/auth.ts", "utf8");
    expect(text).toContain("const LOG = __DEV__");
    expect(text).not.toContain("console.log(");
    expect(text).not.toContain("console.error(");
    expect(text).not.toContain("substring(0, 20)");
    expect(text).not.toContain(", user);");
  });

  it("logs notification settings-read failures", async () => {
    const text = await readFile("lib/notifications.ts", "utf8");
    expect(text).toContain("settings read failed");
  });

  it("logs watchlist background failures", async () => {
    const text = await readFile("app/(tabs)/watchlist.tsx", "utf8");
    expect(text).toContain("queued-count refresh failed");
    expect(text).toContain("settings persist failed");
    expect(text).toContain("[Watchlist] share failed");
  });

  it("logs image-share fallback on compare and product screens", async () => {
    const compare = await readFile("app/compare/[id].tsx", "utf8");
    const product = await readFile("app/product/[id].tsx", "utf8");
    expect(compare).toContain("falling back to text");
    expect(product).toContain("falling back to text");
  });
});
