import { Text, View } from "react-native";
import { Card } from "@/components/ui/card";
import { useColors } from "@/hooks/use-colors";
import { dealBandLabel, type DealScore } from "@/lib/deal-score";

export function DealScoreCard({ dealScore }: { dealScore: DealScore }) {
  const colors = useColors();
  return (
    <Card style={{ marginHorizontal: 16, marginBottom: 16 }}>
      <Text
        style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}
      >
        Deal Score {dealScore.score} — {dealBandLabel(dealScore.band)}
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 8,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Range {dealScore.factors.range}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Trend {dealScore.factors.trend}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Streak {dealScore.factors.streak}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Volatility {dealScore.factors.volatility}
        </Text>
      </View>
    </Card>
  );
}
