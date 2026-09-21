import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

// Guards two crashes found only by running the release APK on a device. Both
// pass tsc/lint/unit tests, so they need explicit source-level guards.
//
// 1. On React Native `global.window === global`, so
//    `typeof window !== "undefined"` is TRUE on native while
//    `window.addEventListener` is undefined — calling it crashed the app at
//    launch.
// 2. `Animated.event(..., { useNativeDriver: true })` on a plain VirtualizedList
//    (SectionList/FlatList) throws "Components based on VirtualizedList must be
//    wrapped with Animated.createAnimatedComponent".

// Strip comments so a mention of a pattern in prose doesn't trip a guard.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("React Native platform guards", () => {
  it("the root layout does not guard window.addEventListener with typeof-window", async () => {
    const src = stripComments(await readFile("app/_layout.tsx", "utf8"));
    // The bug shape: a typeof-window check immediately guarding the listener.
    expect(src).not.toMatch(
      /typeof window !== "undefined"[\s\S]{0,80}window\.addEventListener/,
    );
    // It must instead gate on the platform.
    expect(src).toMatch(/if \(Platform\.OS !== "web"\) return;/);
  });

  it("the watchlist wraps SectionList for its native-driver scroll event", async () => {
    const src = stripComments(await readFile("app/(tabs)/watchlist.tsx", "utf8"));
    if (!/useNativeDriver:\s*true/.test(src)) return;
    expect(src).toMatch(/createAnimatedComponent\(\s*SectionList,?\s*\)/);
    // And the animated component must be the one rendered.
    expect(src).toMatch(/<AnimatedSectionList\b/);
    expect(src).not.toMatch(/<SectionList\b/);
  });
});
