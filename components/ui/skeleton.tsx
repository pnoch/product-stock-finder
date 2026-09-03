import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, View, ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useColors } from "@/hooks/use-colors";

export function SkeletonBox({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.35)).current;
  const reduceMotionEnabled = useReducedMotion();

  useEffect(() => {
    if (reduceMotionEnabled) {
      opacity.setValue(0.6);
      return;
    }
    // Fallback to AccessibilityInfo when reanimated hook is unavailable / web sync check
    let anim: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    const startLoop = () => {
      if (cancelled) return;
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.7,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.35,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
    };
    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (enabled) {
            opacity.setValue(0.6);
            return;
          }
          startLoop();
        })
        .catch(() => startLoop());
      return () => {
        cancelled = true;
        anim?.stop();
      };
    }
    startLoop();
    return () => anim?.stop();
  }, [opacity, reduceMotionEnabled]);

  return (
    <Animated.View
      style={
        {
          width: width as never,
          height: height as never,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
          ...style,
        } as never
      }
    />
  );
}

export function SkeletonCard() {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1, gap: 8, marginRight: 12 }}>
          <SkeletonBox width="75%" height={14} borderRadius={6} />
          <SkeletonBox width="45%" height={11} borderRadius={6} />
          <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
            <SkeletonBox width={60} height={16} borderRadius={8} />
            <SkeletonBox width={50} height={16} borderRadius={8} />
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <SkeletonBox width={70} height={20} borderRadius={10} />
          <SkeletonBox width={80} height={14} borderRadius={6} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

export function SkeletonDetailHeader() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
      <SkeletonBox width="60%" height={20} borderRadius={6} />
      <SkeletonBox width="40%" height={12} borderRadius={6} />
      <SkeletonBox width="90%" height={14} borderRadius={6} />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
        <SkeletonBox width={90} height={28} borderRadius={14} />
        <SkeletonBox width={90} height={28} borderRadius={14} />
      </View>
    </View>
  );
}

export function SkeletonChart() {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <SkeletonBox width="40%" height={14} borderRadius={6} />
      <View style={{ height: 140, marginTop: 16, justifyContent: "flex-end" }}>
        <SkeletonBox width="100%" height={100} borderRadius={8} />
      </View>
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginTop: 12,
          justifyContent: "center",
        }}
      >
        <SkeletonBox width={50} height={26} borderRadius={14} />
        <SkeletonBox width={50} height={26} borderRadius={14} />
        <SkeletonBox width={50} height={26} borderRadius={14} />
      </View>
    </View>
  );
}
