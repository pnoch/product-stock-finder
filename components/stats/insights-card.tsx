import { memo, useMemo } from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { ProductInsightsResult } from "@/lib/product-insights";

export const InsightsCard = memo(function InsightsCard({ result }: { result: ProductInsightsResult }) {
  const colors = useColors();
  const lows = useMemo(
    () => result.products.filter((p) => p.atAllTimeLow).slice(0, 3),
    [result.products],
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
        Product Insights
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: colors.success, fontSize: 18, fontWeight: "700" }}
          >
            {result.allTimeLows}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            At all-time low
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: colors.primary, fontSize: 18, fontWeight: "700" }}
          >
            {result.droppingCount}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>Dropping now</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 18,
              fontWeight: "700",
            }}
          >
            {result.volatility.low}·{result.volatility.medium}·
            {result.volatility.high}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            Volatility L·M·H
          </Text>
        </View>
      </View>
      {lows.length > 0 && (
        <View style={{ marginTop: 10 }}>
          {lows.map((p) => (
            <Text
              key={p.productId}
              style={{
                color: colors.success,
                fontSize: 12,
                paddingVertical: 2,
              }}
              numberOfLines={1}
            >
              🏅 {p.name} is at its all-time low
            </Text>
          ))}
        </View>
      )}
    </View>
  );
});
InsightsCard.displayName = "InsightsCard";
