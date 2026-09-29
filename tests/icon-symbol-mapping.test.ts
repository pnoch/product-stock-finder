import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// AGENTS.md: every `<IconSymbol name="...">` must have an Android/web mapping
// in components/ui/icon-symbol.tsx, or it silently renders a "help" glyph on
// Android/web. The mapping is deliberately NOT widened to every SF Symbol, so
// TypeScript catches unmapped names at the call site — but `name={x as never}`
// casts (and names passed through `string`-typed props) defeat that. This
// scans the literals that reach IconSymbol and asserts they are all mapped.
const MAPPING_FILE = "components/ui/icon-symbol.tsx";

function mappedNames(): Set<string> {
  const src = readFileSync(MAPPING_FILE, "utf8");
  const start = src.indexOf("const MAPPING");
  const block = src.slice(start, src.indexOf("} as", start));
  return new Set(
    [...block.matchAll(/^\s*["']?([a-z][a-zA-Z0-9._]*)["']?\s*:/gm)].map(
      (m) => m[1]!,
    ),
  );
}

function sourceFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", "dist", "dist-web", ".expo"].includes(entry.name))
        continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(entry.name)) files.push(p);
    }
  };
  for (const dir of ["app", "components", "lib", "hooks"]) walk(dir);
  return files;
}

describe("IconSymbol name mapping", () => {
  it("maps every literal name passed to IconSymbol", () => {
    const mapped = mappedNames();
    expect(mapped.size).toBeGreaterThan(50);

    const missing: string[] = [];
    for (const file of sourceFiles()) {
      const src = readFileSync(file, "utf8");
      // Every <IconSymbol ...> element, multiline-safe.
      for (const el of src.matchAll(/<IconSymbol\b[\s\S]*?\/?>/g)) {
        const literal = el[0].match(/name=["']([^"']+)["']/);
        if (literal && !mapped.has(literal[1]!)) {
          missing.push(`${file}: ${literal[1]}`);
        }
      }
    }
    expect(missing, `unmapped IconSymbol names:\n${missing.join("\n")}`).toEqual(
      [],
    );
  });

  it("maps every icon-name literal used in a dynamic name expression", () => {
    const mapped = mappedNames();
    // `name={cond ? "a" : "b"}` and `icon: "x"` props: collect every quoted
    // string that looks like an SF Symbol in the icon-bearing files, then
    // assert the ones actually used are mapped. Scoped to files that render an
    // IconSymbol so unrelated string literals are not swept in.
    const missing: string[] = [];
    for (const file of sourceFiles()) {
      const src = readFileSync(file, "utf8");
      if (!src.includes("IconSymbol")) continue;
      for (const el of src.matchAll(/<IconSymbol\b[\s\S]*?\/?>/g)) {
        // Extract only the `name={...}` expression (balanced to the closing
        // brace) so unrelated string literals in the element aren't swept in.
        const expr = el[0].match(/name=\{([\s\S]*?)\}\s/);
        if (!expr) continue;
        // Only ternary *result* literals (after ? or :) are icon names; the
        // comparison operand (e.g. `direction === "rise"`) is not.
        for (const lit of expr[1]!.matchAll(/[?:]\s*"([a-z][a-zA-Z0-9._]*)"/g)) {
          if (!mapped.has(lit[1]!)) missing.push(`${file}: ${lit[1]}`);
        }
      }
    }
    expect(missing, `unmapped dynamic icon names:\n${missing.join("\n")}`).toEqual(
      [],
    );
  });

  it("does not widen the mapping type (which would defeat the guard)", () => {
    const src = readFileSync(MAPPING_FILE, "utf8");
    // `} as IconMapping` widened the key type to every SF Symbol, so an
    // unmapped name type-checked and rendered the fallback glyph.
    expect(src).not.toMatch(/\}\s*as\s+IconMapping/);
  });
});
