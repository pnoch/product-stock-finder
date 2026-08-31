import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@/lib/currency";
import type { PriceVsAverage } from "@/lib/price-average";

const VERDICT_COPY: Record<PriceVsAverage["verdict"], string> = {
  below: "Below average — good time to buy",
  at: "Around its average",
  above: "Above average",
};

export function PriceVsAvgCard({ data, displayCurrency = "USD" }: { data: PriceVsAverage; displayCurrency?: string }) {
  const colors = useColors();
  const color =
    data.verdict === "below"
      ? colors.success
      : data.verdict === "above"
        ? colors.error
        : colors.muted;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
      }}
    >
      <Text
        style={{
          color,
          fontSize: 24,
          fontWeight: "700",
          minWidth: 84,
        }}
      >
        {data.percentVsAvg > 0 ? "+" : ""}
        {data.percentVsAvg.toFixed(1)}%
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          vs 30-day average · avg {formatPrice(data.average, displayCurrency)}
        </Text>
        <Text style={{ color: colors.foreground, fontSize: 13, marginTop: 2 }}>
          {VERDICT_COPY[data.verdict]}
        </Text>
      </View>
    </View>
  );
}
