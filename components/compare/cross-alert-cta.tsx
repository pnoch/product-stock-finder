import { useMemo } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { convertPrice, formatPrice } from "@/lib/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function CrossAlertCTA({
  listings,
  displayCurrency = "USD",
  onPress,
}: {
  listings: DistributorListing[];
  displayCurrency?: string;
  onPress: () => void;
}) {
  const colors = useColors();

  const best = useMemo(() => {
    const inStock = listings.filter((l) => l.stockStatus === "in_stock");
    if (inStock.length === 0) return null;
    const vals = inStock
      .map((l) => convertPrice(l.price, l.currency, displayCurrency))
      .filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return Math.min(...vals);
  }, [listings, displayCurrency]);

  if (best === null) return null;

  return (
    <TouchableOpacity activeOpacity={0.85}
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
          {formatPrice(best * 0.95, displayCurrency)} (5% below current best of {formatPrice(best, displayCurrency)})
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={16} color={colors.primary} />
    </TouchableOpacity>
  );
}
