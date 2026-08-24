import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@/lib/currency";
import type { BasketValueResult } from "@/lib/watchlist-stats";

export function BasketValueCard({
  basket,
  displayCurrency,
}: {
  basket: BasketValueResult;
  displayCurrency: string;
}) {
  const colors = useColors();

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 16,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 13 }}>
        Basket Value (best in-stock prices)
      </Text>
      <Text
        style={{
          color: colors.foreground,
          fontSize: 26,
          fontWeight: "700",
          marginTop: 4,
        }}
      >
        {formatPrice(basket.total, displayCurrency)}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
        {basket.productCount} products
        {basket.excludedCount > 0
          ? ` · ${basket.excludedCount} excluded (no stock)`
          : ""}
      </Text>
    </View>
  );
}
