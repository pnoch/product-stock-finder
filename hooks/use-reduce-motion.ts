import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// RN `Animated` components cannot import the reanimated hook without pulling
// the worklets runtime into every test that renders them. AccessibilityInfo is
// the same source of truth and stays test-friendly.
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (enabled) => {
        if (active) setReduceMotion(enabled);
      },
    );
    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, []);

  return reduceMotion;
}
