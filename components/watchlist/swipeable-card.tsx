import { useCallback, useRef } from "react";
import { Animated, Platform, Text, View } from "react-native";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function SwipeableCard({
  children,
  onDelete,
  enabled = true,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  enabled?: boolean;
}) {
  const colors = useColors();
  const swipeableRef = useRef<Swipeable>(null);

  const handleWillOpen = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const renderRightActions = useCallback(
    (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      const scale = dragX.interpolate({
        inputRange: [-88, -20, 0],
        outputRange: [1, 0.85, 0.7],
        extrapolate: "clamp",
      });
      const opacity = dragX.interpolate({
        inputRange: [-88, -40, 0],
        outputRange: [1, 0.6, 0],
        extrapolate: "clamp",
      });
      return (
        <Animated.View
          style={{
            width: 88,
            marginLeft: 8,
            borderRadius: 16,
            backgroundColor: colors.error,
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            opacity,
            transform: [{ scale }],
          }}
        >
          <RectButton
            accessible
            accessibilityLabel="Remove from watchlist"
            accessibilityRole="button"
            accessibilityHint="Removes this product from your watchlist"
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              swipeableRef.current?.close();
              onDelete();
            }}
            style={{
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              borderRadius: 16,
            }}
          >
            <IconSymbol name="trash.fill" size={20} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
              Remove
            </Text>
          </RectButton>
        </Animated.View>
      );
    },
    [colors.error, onDelete],
  );

  return (
    <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 0, backgroundColor: colors.error + "18" }}>
      <Swipeable
        ref={swipeableRef}
        enabled={enabled}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        friction={2}
        overshootRight={false}
        onSwipeableWillOpen={handleWillOpen}
      >
        {children}
      </Swipeable>
    </View>
  );
}
