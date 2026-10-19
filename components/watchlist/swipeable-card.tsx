import { useCallback, useRef } from "react";
import { Platform, Text, View } from "react-native";
import { RectButton } from "react-native-gesture-handler";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

const ACTION_WIDTH = 72;

type RightActionsProps = {
  translation: SharedValue<number>;
  width: number;
  colors: ReturnType<typeof useColors>;
  showAlert: boolean;
  showAcquired: boolean;
  hasAlert: boolean;
  isAcquired: boolean;
  onClose: () => void;
  onToggleAlert?: () => void;
  onToggleAcquired?: () => void;
  onDelete: () => void;
};

function RightActions({
  translation,
  width,
  colors,
  showAlert,
  showAcquired,
  hasAlert,
  isAcquired,
  onClose,
  onToggleAlert,
  onToggleAcquired,
  onDelete,
}: RightActionsProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      translation.value,
      [-width, -20, 0],
      [1, 0.85, 0.7],
      "clamp",
    );
    const opacity = interpolate(
      translation.value,
      [-width, -40, 0],
      [1, 0.6, 0],
      "clamp",
    );
    return { opacity, transform: [{ scale }] };
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
      style={[
        {
          width,
          marginLeft: 8,
          borderRadius: 16,
          overflow: "hidden",
          flexDirection: "row",
        },
        animatedStyle,
      ]}
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
            onClose();
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
            onClose();
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
          onClose();
          onDelete();
        }}
        style={{ ...actionStyle, backgroundColor: colors.error }}
      >
        <IconSymbol name="trash.fill" size={20} color="#fff" />
        <Text style={{ ...labelStyle, color: "#fff" }}>Remove</Text>
      </RectButton>
    </Animated.View>
  );
}

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
  const swipeableRef = useRef<SwipeableMethods>(null);

  const showAlert = onToggleAlert != null;
  const showAcquired = onToggleAcquired != null;
  const width = ACTION_WIDTH * (1 + (showAlert ? 1 : 0) + (showAcquired ? 1 : 0));

  const handleWillOpen = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const renderRightActions = useCallback(
    (_progress: SharedValue<number>, translation: SharedValue<number>) => (
      <RightActions
        translation={translation}
        width={width}
        colors={colors}
        showAlert={showAlert}
        showAcquired={showAcquired}
        hasAlert={hasAlert ?? false}
        isAcquired={isAcquired ?? false}
        onClose={() => swipeableRef.current?.close()}
        onToggleAlert={onToggleAlert}
        onToggleAcquired={onToggleAcquired}
        onDelete={onDelete}
      />
    ),
    [colors, hasAlert, isAcquired, onDelete, onToggleAcquired, onToggleAlert, showAcquired, showAlert, width],
  );

  return (
    <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 0, backgroundColor: colors.error + "18" }}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        enabled={enabled}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        friction={2}
        overshootRight={false}
        onSwipeableWillOpen={handleWillOpen}
      >
        {children}
      </ReanimatedSwipeable>
    </View>
  );
}
