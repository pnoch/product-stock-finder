import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// Guards the class of bug that broke `pnpm db:push` in CI: a migration file
// ending with a trailing `--> statement-breakpoint` makes drizzle emit an empty
// final statement, and MySQL rejects it with ER_EMPTY_QUERY ("Query was empty"),
// aborting the whole migration run.
describe("drizzle migration files", () => {
  it("never end with a trailing statement-breakpoint", async () => {
    const dir = "drizzle";
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = await readFile(path.join(dir, file), "utf8");
      const trimmed = content.trimEnd();
      expect(
        trimmed.endsWith("--> statement-breakpoint"),
        `${file} ends with a trailing statement-breakpoint`,
      ).toBe(false);
    }
  });

  it("has no empty statements between breakpoints", async () => {
    const dir = "drizzle";
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql"));
    for (const file of files) {
      const content = await readFile(path.join(dir, file), "utf8");
      const parts = content.split("--> statement-breakpoint");
      // Every part except a possible trailing whitespace-only tail must have SQL.
      const empties = parts.filter((p, i) => {
        const isLast = i === parts.length - 1;
        return p.trim() === "" && !isLast;
      });
      expect(empties, `${file} has an empty statement`).toHaveLength(0);
    }
  });
});
