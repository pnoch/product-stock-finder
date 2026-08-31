import { memo, useMemo } from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { DataFreshnessResult } from "@/lib/watchlist-stats";

export const DataFreshnessCard = memo(function DataFreshnessCard({
  freshness,
}: {
  freshness: DataFreshnessResult;
}) {
  const colors = useColors();

  const oldestLabel = useMemo(
    () =>
      freshness.oldestCheck
        ? new Date(freshness.oldestCheck).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—",
    [freshness.oldestCheck],
  );

  const rows = useMemo(
    () => [
      {
        label: "Avg data points / listing",
        value: `${freshness.avgHistoryPoints}`,
      },
      { label: "Stale (>7 days)", value: `${freshness.staleCount}` },
      { label: "Never checked", value: `${freshness.neverCheckedCount}` },
      { label: "Oldest check", value: oldestLabel },
    ],
    [freshness.avgHistoryPoints, freshness.neverCheckedCount, freshness.staleCount, oldestLabel],
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
        Data Freshness
      </Text>
      {rows.map((row) => (
        <View
          key={row.label}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 13 }}>{row.label}</Text>
          <Text
            style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
});
DataFreshnessCard.displayName = "DataFreshnessCard";
