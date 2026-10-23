import { Text, View } from "react-native";
import { dealBandLabel, type DealScore } from "@/lib/deal-score";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function ProductCardInsights({
  colors,
  insight,
  dealScore,
  hasTags,
}: {
  colors: Colors;
  insight?: { atAllTimeLow: boolean; dropStreak: number };
  dealScore?: DealScore | null;
  hasTags: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginTop: hasTags ? 6 : 10,
      }}
    >
      {insight?.atAllTimeLow && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: colors.success + "22",
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={{ color: colors.success, fontSize: 10, fontWeight: "700" }}>
            All-time low
          </Text>
        </View>
      )}
      {insight != null && insight.dropStreak >= 2 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: colors.primary + "22",
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "700" }}>
            ▼ Dropping ×{insight.dropStreak}
          </Text>
        </View>
      )}
      {dealScore != null && dealScore.band === "hot" && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: colors.warning + "22",
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={{ color: colors.warning, fontSize: 10, fontWeight: "700" }}>
            {dealBandLabel(dealScore.band)}
          </Text>
        </View>
      )}
    </View>
  );
}
