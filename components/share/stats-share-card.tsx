import { forwardRef } from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@shared/currency";

export interface StatsShareDrop {
  flag: string;
  name: string;
  pct: number;
}

export const StatsShareCard = forwardRef<
  View,
  {
    basketTotal: number;
    productCount: number;
    displayCurrency: string;
    drops: StatsShareDrop[];
    stockLine: string | null;
  }
>(function StatsShareCard(
  { basketTotal, productCount, displayCurrency, drops, stockLine },
  ref,
) {
  const colors = useColors();

  return (
    <View
      ref={ref}
      style={{
        width: 360,
        backgroundColor: colors.background,
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          backgroundColor: colors.primary,
          paddingVertical: 14,
          paddingHorizontal: 18,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
          Product Stock Finder
        </Text>
      </View>
      <View style={{ padding: 18 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>My Watchlist</Text>
        <Text
          style={{
            color: colors.foreground,
            fontWeight: "700",
            fontSize: 26,
            marginTop: 2,
          }}
        >
          {formatPrice(basketTotal, displayCurrency)}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
          {productCount} products
        </Text>

        {drops.length > 0 && (
          <>
            <View
              style={{
                height: 1,
                backgroundColor: colors.border,
                marginVertical: 12,
              }}
            />
            <Text
              style={{ color: colors.success, fontSize: 12, fontWeight: "700" }}
            >
              ▼ TOP DROPS
            </Text>
            {drops.map((drop) => (
              <View
                key={`${drop.name}-${drop.pct}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 5,
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 13 }}>{drop.flag}</Text>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 12,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {drop.name}
                </Text>
                <Text
                  style={{ color: colors.success, fontSize: 12, fontWeight: "700" }}
                >
                  {drop.pct}%
                </Text>
              </View>
            ))}
          </>
        )}

        {stockLine && (
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 10 }}>
            {stockLine}
          </Text>
        )}
        <Text style={{ color: colors.muted, fontSize: 10, marginTop: 10 }}>
          via Product Stock Finder
        </Text>
      </View>
    </View>
  );
});
