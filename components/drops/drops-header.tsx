import { Text, TouchableOpacity, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function DropsHeader({
  colors,
  onBack,
  onShare,
}: {
  colors: Colors;
  onBack: () => void;
  onShare: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        gap: 12,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        accessibilityLabel="Go back"
        accessibilityRole="button"
        onPress={onBack}
        style={{ padding: 4 }}
        hitSlop={12}
      >
        <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
      </TouchableOpacity>
      <Text
        style={{
          color: colors.foreground,
          fontSize: 28,
          fontWeight: "700",
          flex: 1,
        }}
      >
        Price Drops
      </Text>
      <TouchableOpacity
        activeOpacity={0.7}
        accessibilityLabel="Share price drops"
        accessibilityRole="button"
        onPress={onShare}
        style={{ padding: 4 }}
        hitSlop={12}
      >
        <IconSymbol
          name="square.and.arrow.up"
          size={22}
          color={colors.primary}
        />
      </TouchableOpacity>
    </View>
  );
}
