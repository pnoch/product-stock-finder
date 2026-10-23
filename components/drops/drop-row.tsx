import { Pressable, Text, View } from "react-native";
import { formatPrice } from "@shared/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatDropPct, type PriceDrop } from "@/lib/price-leaderboard";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function DropRow({
  drop,
  colors,
  onPress,
}: {
  drop: PriceDrop;
  colors: Colors;
  onPress: () => void;
}) {
  const pctText = formatDropPct(drop.dropPct);
  const absText = `\u2212${formatPrice(drop.dropAbs, drop.currency)}`;
  const priceLine = `${formatPrice(drop.previousPrice, drop.currency)} \u2192 ${formatPrice(drop.currentPrice, drop.currency)}`;
  const subtitle = drop.modelNumber
    ? drop.modelNumber
    : drop.distributorName;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${drop.productName} dropped ${pctText} at ${drop.distributorName}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 8,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primary + "18",
          marginRight: 12,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.primary }}>
          {initials(drop.productName)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}
        >
          {drop.productName}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}
        >
          {subtitle}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 }}>
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
              backgroundColor: colors.success + "18",
            }}
          >
            <Text
              style={{ fontSize: 11, fontWeight: "700", color: colors.success }}
            >
              {drop.distributorName}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>
            {priceLine}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.success }}>
          {pctText}
        </Text>
        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
          {absText}
        </Text>
        <IconSymbol name="chevron.right" size={14} color={colors.muted} />
      </View>
    </Pressable>
  );
}
