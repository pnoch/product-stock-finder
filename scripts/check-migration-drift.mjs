#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const source = "drizzle";
// drizzle-kit prefixes `out` with "./", so the scratch dir must be relative.
const dir = join("node_modules", ".cache", `drizzle-drift-${process.pid}`);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
for (const entry of readdirSync(source)) {
  cpSync(join(source, entry), join(dir, entry), { recursive: true });
}
const before = new Set(readdirSync(dir).filter((f) => f.endsWith(".sql")));

let failed = false;
try {
  execFileSync("pnpm", ["exec", "drizzle-kit", "generate"], {
    stdio: "inherit",
    env: { ...process.env, DRIZZLE_OUT: dir },
  });
} catch {
  failed = true;
}

const added = readdirSync(dir).filter(
  (f) => f.endsWith(".sql") && !before.has(f),
);
rmSync(dir, { recursive: true, force: true });

if (failed) process.exit(1);
if (added.length > 0) {
  console.error(
    `Schema changes are not committed as a migration: ${added.join(", ")}`,
  );
  console.error("Run `pnpm db:push` and commit the generated files.");
  process.exit(1);
}
console.log("No migration drift.");
