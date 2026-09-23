import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

function desktopSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...desktopSources(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

// The shared logger lives in shared/src/log.ts. Desktop must import it rather
// than reimplementing a local LOG_ERROR (which would drift from the mobile
// implementation and could log in production).
describe("desktop shared logger", () => {
  it("does not reimplement LOG_ERROR locally", async () => {
    for (const file of desktopSources("desktop/src")) {
      const text = await readFile(file, "utf8");
      expect(text, file).not.toContain("const LOG_ERROR =");
    }
  });
});
