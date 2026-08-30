import { useMemo } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { convertPrice } from "@/lib/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function CrossAlertCTA({
  listings,
  onPress,
}: {
  listings: DistributorListing[];
  onPress: () => void;
}) {
  const colors = useColors();

  const bestUSD = useMemo(() => {
    const inStock = listings.filter((l) => l.stockStatus === "in_stock");
    if (inStock.length === 0) return null;
    return Math.min(
      ...inStock.map((l) => convertPrice(l.price, l.currency, "USD")),
    );
  }, [listings]);

  if (bestUSD === null) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: colors.primary + "18",
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.primary + "44",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
      accessibilityLabel="Set cross-distributor alert"
      accessibilityRole="button"
    >
      <IconSymbol name="bell.fill" size={18} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.primary,
            fontWeight: "700",
            fontSize: 13,
          }}
        >
          Alert me if any distributor drops below
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontSize: 12,
            marginTop: 1,
          }}
        >
          ${(bestUSD * 0.95).toFixed(2)} (5% below current best of $
          {bestUSD.toFixed(2)})
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={16} color={colors.primary} />
    </TouchableOpacity>
  );
}
