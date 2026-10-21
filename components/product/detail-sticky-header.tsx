import { Animated, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function DetailStickyHeader({
  productName,
  opacity,
  topInset,
  onEdit,
  onShare,
  onExportCsv,
}: {
  productName: string;
  opacity: Animated.AnimatedInterpolation<number>;
  topInset: number;
  onEdit: () => void;
  onShare: () => void;
  onExportCsv: () => void;
}) {
  const colors = useColors();
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingHorizontal: 16,
        paddingVertical: 10,
        paddingTop: topInset + 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        opacity,
      }}
    >
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "700",
          fontSize: 14,
          flex: 1,
        }}
        numberOfLines={1}
      >
        {productName}
      </Text>
      <View
        pointerEvents="auto"
        style={{ flexDirection: "row", alignItems: "center" }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onEdit}
          style={{ padding: 4, marginLeft: 8 }}
          accessibilityLabel="Edit product"
          accessibilityRole="button"
          hitSlop={10}
        >
          <IconSymbol name="pencil" size={18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onShare}
          style={{ padding: 4, marginLeft: 8 }}
          accessibilityLabel="Share product"
          accessibilityRole="button"
          hitSlop={10}
        >
          <IconSymbol
            name="square.and.arrow.up"
            size={18}
            color={colors.primary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onExportCsv}
          style={{ padding: 4, marginLeft: 8 }}
          accessibilityLabel="Export CSV"
          accessibilityRole="button"
          hitSlop={10}
        >
          <IconSymbol
            name="square.and.arrow.down"
            size={18}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
