import { Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@/lib/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { BasketValueResult } from "@/lib/watchlist-stats";

export function BasketValueCard({
  basket,
  displayCurrency,
  alertThreshold,
  onOpenAlert,
}: {
  basket: BasketValueResult;
  displayCurrency: string;
  alertThreshold?: number | null;
  onOpenAlert?: () => void;
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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          Basket Value (best in-stock prices)
        </Text>
        {onOpenAlert && (
          <TouchableOpacity onPress={onOpenAlert} hitSlop={8}>
            <IconSymbol
              name={alertThreshold ? "bell.fill" : "bell"}
              size={15}
              color={alertThreshold ? colors.primary : colors.muted}
            />
          </TouchableOpacity>
        )}
      </View>
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
      {alertThreshold != null && (
        <Text style={{ color: colors.primary, fontSize: 11, marginTop: 2 }}>
          🔔 Alert below {formatPrice(alertThreshold, displayCurrency)}
        </Text>
      )}
    </View>
  );
}
