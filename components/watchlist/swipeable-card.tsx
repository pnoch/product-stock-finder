import { useCallback, useRef } from "react";
import { Platform, Text, View } from "react-native";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function SwipeableCard({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const colors = useColors();
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = useCallback(
    () => (
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
          width: 88,
          marginLeft: 8,
          borderRadius: 16,
          backgroundColor: colors.error,
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <IconSymbol name="trash.fill" size={20} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
          Remove
        </Text>
      </RectButton>
    ),
    [colors.error, onDelete],
  );

  return (
    <View>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
      >
        {children}
      </Swipeable>
    </View>
  );
}
