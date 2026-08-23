import { Text, View, TouchableOpacity } from "react-native";

import { MultiLineChart } from "@/components/compare/multi-line-chart";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TimeRange, TIME_RANGES } from "@/lib/compare-utils";
import { PricePoint } from "@/lib/types";

export function ChartCard({
  timeRange,
  onRangeChange,
  chartSeries,
  chartWidth,
}: {
  timeRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  chartSeries: Array<{
    label: string;
    color: string;
    data: PricePoint[];
    currency: string;
  }>;
  chartWidth: number;
}) {
  const colors = useColors();

  return (
    <View
      style={{
        marginHorizontal: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <Text
          style={{
            color: colors.foreground,
            fontWeight: "700",
            fontSize: 15,
          }}
        >
          Price History (USD)
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {TIME_RANGES.map((r) => {
            const active = r === timeRange;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => onRangeChange(r)}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: active
                    ? colors.primary
                    : colors.border + "44",
                }}
              >
                <Text
                  style={{
                    color: active ? "#fff" : colors.muted,
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <Text
        style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}
      >
        Select up to 5 distributors to overlay
      </Text>
      {chartSeries.length >= 2 ? (
        <MultiLineChart
          series={chartSeries}
          width={chartWidth}
          height={220}
        />
      ) : (
        <View
          style={{
            height: 120,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconSymbol
            name="chart.bar.xaxis"
            size={36}
            color={colors.muted}
          />
          <Text
            style={{
              color: colors.muted,
              fontSize: 13,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            Select at least 2 distributors{"\n"}with price history to
            compare
          </Text>
        </View>
      )}
      {chartSeries.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 12,
          }}
        >
          {chartSeries.map((s) => (
            <View
              key={s.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: s.color,
                }}
              />
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
