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

  // 3. Phase 256 folded the Android app-state listener into the launch-setup
  //    effect with an early `return` on Android. That skipped channel creation,
  //    permission requests, background-task registration, the launch price
  //    check, and push/server notification setup on Android entirely — a fresh
  //    install created no notification channels (verified on device). The
  //    listener must live in its own effect, and the launch setup must not
  //    early-return on Android.
  it("the Android app-state listener does not short-circuit launch setup", async () => {
    const src = stripComments(await readFile("app/_layout.tsx", "utf8"));
    const channelSetup = src.indexOf("setupAndroidNotificationChannel()");
    expect(channelSetup).toBeGreaterThan(-1);
    // The setup effect (the one containing the channel call) must not
    // early-return on Android.
    const setupEffectStart = src.lastIndexOf("useEffect(", channelSetup);
    const setupEffect = src.slice(setupEffectStart, channelSetup);
    expect(setupEffect).not.toContain('Platform.OS === "android"');
    // The app-state listener must live in its own effect, gated the other way.
    const listener = src.indexOf("setBackgroundAppState(state");
    expect(listener).toBeGreaterThan(-1);
    const listenerEffectStart = src.lastIndexOf("useEffect(", listener);
    const listenerEffect = src.slice(listenerEffectStart, listener);
    expect(listenerEffect).toContain('if (Platform.OS !== "android") return;');
  });
});
