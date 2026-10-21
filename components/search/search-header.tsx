import { Platform, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function SearchHeader({
  mode,
  onBack,
  onManualAdd,
  onBulkImport,
}: {
  mode: "add" | "discover";
  onBack: () => void;
  onManualAdd: () => void;
  onBulkImport: () => void;
}) {
  const colors = useColors();
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
      {mode === "add" && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onBack}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={{ padding: 4 }}
          hitSlop={12}
        >
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
      )}
      <Text
        style={{
          color: colors.foreground,
          fontSize: mode === "discover" ? 28 : 20,
          fontWeight: "700",
          flex: 1,
        }}
      >
        {mode === "discover" ? "Discover" : "Add Product"}
      </Text>
      <TouchableOpacity
        activeOpacity={0.7}
        accessibilityLabel="Add product manually or import marketplace link"
        accessibilityRole="button"
        onPress={() => {
          if (Platform.OS !== "web")
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onManualAdd();
        }}
        style={{ padding: 4 }}
        hitSlop={12}
      >
        <IconSymbol name="wand.and.stars" size={22} color={colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.7}
        accessibilityLabel="Bulk import products"
        accessibilityRole="button"
        onPress={() => {
          if (Platform.OS !== "web")
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onBulkImport();
        }}
        style={{ padding: 4 }}
        hitSlop={12}
      >
        <IconSymbol
          name="square.and.arrow.down"
          size={22}
          color={colors.primary}
        />
      </TouchableOpacity>
    </View>
  );
}
