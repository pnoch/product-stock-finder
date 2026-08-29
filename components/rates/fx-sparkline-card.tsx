import { Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { useColors } from "@/hooks/use-colors";

interface FxSparklineCardProps {
  currency: string;
  flag: string;
  rate: number;
  change: number;
  history: number[];
}

export function FxSparklineCard({
  currency,
  flag,
  rate,
  change,
  history,
}: FxSparklineCardProps) {
  const colors = useColors();
  const changeColor = change > 0 ? colors.success : change < 0 ? colors.error : colors.muted;

  const sparklinePoints = history.length >= 2
    ? (() => {
        const min = Math.min(...history);
        const max = Math.max(...history);
        const range = max - min || 1;
        return history
          .map((v, i) => {
            const x = (i / (history.length - 1)) * 56;
            const y = 20 - ((v - min) / range) * 18;
            return `${x},${y}`;
          })
          .join(" ");
      })()
    : "";

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 12,
        flex: 1,
        minWidth: "45%",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ fontSize: 20 }}>{flag}</Text>
        <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14 }}>
          {currency}
        </Text>
      </View>
      <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", marginTop: 4 }}>
        {rate.toFixed(4)}
      </Text>
      <Text style={{ color: changeColor, fontSize: 12, fontWeight: "600", marginTop: 2 }}>
        {change > 0 ? "+" : ""}{change.toFixed(2)}%
      </Text>
      {sparklinePoints ? (
        <Svg width={60} height={24} style={{ marginTop: 6 }}>
          <Polyline
            points={sparklinePoints}
            fill="none"
            stroke={colors.primary}
            strokeWidth={1.5}
          />
        </Svg>
      ) : (
        <View style={{ height: 24, marginTop: 6 }} />
      )}
    </View>
  );
}