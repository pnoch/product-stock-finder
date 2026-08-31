import { Text, View, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

interface CompareHeaderProps {
  productName: string;
  isRefreshing: boolean;
  onRefresh: () => Promise<boolean>;
  onBack: () => void;
}

export function CompareHeader({
  productName,
  isRefreshing,
  onRefresh,
  onBack,
}: CompareHeaderProps) {
  const colors = useColors();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
        gap: 12,
      }}
    >
      <TouchableOpacity activeOpacity={0.7} onPress={onBack} style={{ padding: 4 }} accessibilityLabel="Go back" accessibilityRole="button">
        <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 18,
            fontWeight: "700",
          }}
          numberOfLines={1}
        >
          Compare Prices
        </Text>
        <Text
          style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}
          numberOfLines={1}
        >
          {productName}
        </Text>
      </View>
      <TouchableOpacity activeOpacity={0.7}
        onPress={async () => {
          if (Platform.OS !== "web")
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const ok = await onRefresh();
          if (!ok) {
            showAlert(
              "Couldn't refresh prices",
              "The server is unreachable. Showing saved prices.",
            );
          }
        }}
        disabled={isRefreshing}
        style={{ padding: 4 }}
        accessibilityLabel="Refresh prices"
        accessibilityRole="button"
      >
        {isRefreshing ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <IconSymbol name="arrow.clockwise" size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    </View>
  );
}
