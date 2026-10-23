import { useCallback, useState } from "react";
import { Animated, Platform, TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function AlertsFab({
  visible,
  bottomInset,
  onPress,
}: {
  visible: boolean;
  bottomInset: number;
  onPress: () => void;
}) {
  const colors = useColors();
  const reduceMotion = useReduceMotion();
  const fabScale = useState(() => new Animated.Value(1))[0];

  const handlePressIn = useCallback(() => {
    if (reduceMotion) return;
    Animated.spring(fabScale, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
      bounciness: 6,
    }).start();
  }, [fabScale, reduceMotion]);

  const handlePressOut = useCallback(() => {
    if (reduceMotion) return;
    Animated.spring(fabScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }, [fabScale, reduceMotion]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 24 + bottomInset,
        right: 20,
        transform: [{ scale: fabScale }],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          if (Platform.OS !== "web")
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: colors.primary,
          shadowOpacity: 0.35,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
        accessibilityLabel="Add product"
        accessibilityRole="button"
      >
        <IconSymbol name="plus" size={26} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}
