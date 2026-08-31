import { memo, useMemo } from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { StockHealthResult } from "@/lib/watchlist-stats";

export const StockHealthCard = memo(function StockHealthCard({ health }: { health: StockHealthResult }) {
  const colors = useColors();

  const rows = useMemo(
    () => [
      {
        label: "Listings in stock",
        value: `${health.inStockPct}%`,
        color: colors.success,
      },
      {
        label: "Fully out of stock",
        value: `${health.fullyOutOfStock}`,
        color: colors.error,
      },
      {
        label: "Back-order everywhere",
        value: `${health.backOrderOnly}`,
        color: colors.warning,
      },
    ],
    [health.inStockPct, health.fullyOutOfStock, health.backOrderOnly, colors.success, colors.error, colors.warning],
  );

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
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>
        Stock Health ({health.totalListings} listings)
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {rows.map((row) => (
          <View key={row.label} style={{ flex: 1 }}>
            <Text style={{ color: row.color, fontSize: 18, fontWeight: "700" }}>
              {row.value}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{row.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});
StockHealthCard.displayName = "StockHealthCard";
