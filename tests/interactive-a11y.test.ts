import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Every tappable element needs an accessible name/role, or screen readers
// announce it as an unlabeled "button". This scans the full opening tag (not a
// fixed line window) so a label on a later line still counts.
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", "dist-web", ".expo"].includes(e.name))
      continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

// A backdrop / inner container is a Pressable for tap-to-dismiss but is not a
// control; it is excluded by requiring an onPress that is not stopPropagation.
function isControl(tag: string): boolean {
  if (!/onPress=/.test(tag)) return false;
  if (/onPress=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/.test(tag)) return false;
  return true;
}

describe("interactive elements have accessible names", () => {
  it("every Touchable/Pressable control carries a11y attributes", () => {
    const missing: string[] = [];
    for (const file of [...walk("app"), ...walk("components")]) {
      const src = readFileSync(file, "utf8");
      const re = /<(TouchableOpacity|Pressable|TouchableHighlight)\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        let i = m.index + m[0].length;
        let depth = 0;
        let end = -1;
        for (; i < src.length; i++) {
          const c = src[i];
          if (c === "{") depth++;
          else if (c === "}") depth--;
          else if (c === ">" && depth === 0) {
            end = i;
            break;
          }
        }
        if (end < 0) continue;
        const tag = src.slice(m.index, end + 1);
        if (!isControl(tag)) continue;
        if (
          !/accessibilityLabel|accessibilityRole|accessibilityHint|aria-label/.test(
            tag,
          )
        ) {
          const line = src.slice(0, m.index).split("\n").length;
          missing.push(`${file}:${line}`);
        }
      }
    }
    expect(missing, `unlabeled controls:\n${missing.join("\n")}`).toEqual([]);
  });
});
