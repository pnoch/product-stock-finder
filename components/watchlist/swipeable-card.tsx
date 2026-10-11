import { useCallback, useRef } from "react";
import { Animated, Platform, Text, View } from "react-native";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

const ACTION_WIDTH = 72;

export function SwipeableCard({
  children,
  onDelete,
  onToggleAlert,
  onToggleAcquired,
  isAcquired,
  hasAlert,
  enabled = true,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  onToggleAlert?: () => void;
  onToggleAcquired?: () => void;
  isAcquired?: boolean;
  hasAlert?: boolean;
  enabled?: boolean;
}) {
  const colors = useColors();
  const swipeableRef = useRef<Swipeable>(null);

  const showAlert = onToggleAlert != null;
  const showAcquired = onToggleAcquired != null;
  const width = ACTION_WIDTH * (1 + (showAlert ? 1 : 0) + (showAcquired ? 1 : 0));

  const handleWillOpen = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const renderRightActions = useCallback(
    (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      const scale = dragX.interpolate({
        inputRange: [-width, -20, 0],
        outputRange: [1, 0.85, 0.7],
        extrapolate: "clamp",
      });
      const opacity = dragX.interpolate({
        inputRange: [-width, -40, 0],
        outputRange: [1, 0.6, 0],
        extrapolate: "clamp",
      });
      const actionStyle = {
        width: ACTION_WIDTH,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        gap: 4,
      };
      const labelStyle = { fontSize: 12, fontWeight: "600" as const };
      return (
        <Animated.View
          style={{
            width,
            marginLeft: 8,
            borderRadius: 16,
            overflow: "hidden",
            flexDirection: "row",
            opacity,
            transform: [{ scale }],
          }}
        >
          {showAlert && (
            <RectButton
              accessible
              accessibilityLabel={hasAlert ? "Manage price alert" : "Set price alert"}
              accessibilityRole="button"
              accessibilityHint="Opens this product to set a price alert"
              onPress={() => {
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                swipeableRef.current?.close();
                onToggleAlert?.();
              }}
              style={{ ...actionStyle, backgroundColor: colors.primary + "1A" }}
            >
              <IconSymbol name="bell.fill" size={20} color={colors.primary} />
              <Text style={{ ...labelStyle, color: colors.primary }}>
                {hasAlert ? "Muted" : "Alert"}
              </Text>
            </RectButton>
          )}
          {showAcquired && (
            <RectButton
              accessible
              accessibilityLabel={isAcquired ? "Mark as not acquired" : "Mark as acquired"}
              accessibilityRole="button"
              accessibilityHint="Toggles whether you own this product"
              onPress={() => {
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                swipeableRef.current?.close();
                onToggleAcquired?.();
              }}
              style={{ ...actionStyle, backgroundColor: colors.success + "1A" }}
            >
              <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
              <Text style={{ ...labelStyle, color: colors.success }}>
                {isAcquired ? "Owned" : "Want"}
              </Text>
            </RectButton>
          )}
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
            style={{ ...actionStyle, backgroundColor: colors.error }}
          >
            <IconSymbol name="trash.fill" size={20} color="#fff" />
            <Text style={{ ...labelStyle, color: "#fff" }}>
              Remove
            </Text>
          </RectButton>
        </Animated.View>
      );
    },
    [colors.error, colors.primary, colors.success, hasAlert, isAcquired, onDelete, onToggleAcquired, onToggleAlert, showAcquired, showAlert, width],
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
