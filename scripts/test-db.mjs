// Runs every DB-gated test file (the ones that check RUN_DB_TESTS), discovered
// from the filesystem rather than a hand-maintained list — a new DB-gated suite
// is picked up automatically instead of silently never running in CI.
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const files = readdirSync("tests")
  .filter((name) => name.endsWith(".test.ts"))
  .filter((name) => readFileSync(`tests/${name}`, "utf8").includes("RUN_DB_TESTS"))
  .map((name) => `tests/${name}`);

if (files.length === 0) {
  console.error("No DB-gated test files found (expected at least one).");
  process.exit(1);
}

console.log(`Running ${files.length} DB-gated test files…`);
const result = spawnSync("pnpm", ["exec", "vitest", "run", ...files], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
