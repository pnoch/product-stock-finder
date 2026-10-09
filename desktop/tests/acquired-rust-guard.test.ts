import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Rust acquired guard", () => {
  it("check_price_drops_inner skips acquired products", () => {
    const src = readFileSync(
      join(__dirname, "..", "src-tauri", "src", "lib.rs"),
      "utf8",
    );
    expect(src).toContain('"acquiredAt"');
    expect(src).toContain("is_acquired");
  });
});