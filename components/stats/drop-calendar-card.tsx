import { memo, useState, useMemo, useCallback } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@/lib/currency";
import type {
  DropCalendarResult,
  DropDay,
} from "@/lib/drop-calendar";

const DAY = 86400000;

function toLocalDateKey(ts: number): string {
  return new Date(ts).toLocaleDateString("en-CA");
}

// Trailing `days` grid ending today: leading blanks for weekday offset,
// then one cell per day anchored to local midnight.
function buildGridCells(days: number, now: number): (number | null)[] {
  const cells: (number | null)[] = [];
  const nowDate = new Date(now);
  const todayMidnight = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate(),
  ).getTime();
  const startTs = todayMidnight - (days - 1) * DAY;
  const startOffset = new Date(startTs).getDay(); // local 0=Sun
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let i = 0; i < days; i++) cells.push(startTs + i * DAY);
  return cells;
}

export const DropCalendarCard = memo(function DropCalendarCard({
  result,
  days,
  now,
}: {
  result: DropCalendarResult;
  days: number;
  now: number;
}) {
  const colors = useColors();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const cells = useMemo(() => buildGridCells(days, now), [days, now]);
  const selected: DropDay | undefined = useMemo(
    () => (selectedKey ? result.byDay.get(selectedKey) : undefined),
    [selectedKey, result.byDay],
  );
  const handleSelect = useCallback(
    (ts: number) => {
      const key = toLocalDateKey(ts);
      setSelectedKey((prev) => (prev === key ? null : key));
    },
    [],
  );

  const cellStyle = (ts: number) => {
    const key = toLocalDateKey(ts);
    const day = result.byDay.get(key);
    const isToday = key === toLocalDateKey(now);
    const base = {
      width: 34,
      height: 34,
      borderRadius: 8,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 4,
    };
    if (!day) return { ...base, backgroundColor: "transparent" };
    const intensity =
      day.dropCount >= 3 ? colors.success : colors.success + "55";
    return {
      ...base,
      backgroundColor: intensity,
      borderColor: isToday ? colors.primary : colors.success,
    };
  };

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
      <Text style={{ color: colors.muted, fontSize: 13 }}>
        {result.totalDrops} price drops in the last {days} days
      </Text>

      <View style={{ flexDirection: "row", marginTop: 10, gap: 4 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <Text
            key={i}
            style={{
              color: colors.muted,
              fontSize: 9,
              width: 34,
              textAlign: "center",
            }}
          >
            {d}
          </Text>
        ))}
      </View>

      <View style={{ flexWrap: "wrap", flexDirection: "row", gap: 4 }}>
        {cells.map((ts, i) =>
          ts === null ? (
            <View
              key={`blank-${i}`}
              style={{ width: 34, height: 34, marginBottom: 4 }}
            />
          ) : (
            <TouchableOpacity
              key={ts}
              onPress={() => handleSelect(ts)}
              style={cellStyle(ts)}
              accessibilityLabel={`Price drops on ${new Date(ts).toLocaleDateString()}`}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.foreground, fontSize: 11 }}>
                {new Date(ts).getDate()}
              </Text>
            </TouchableOpacity>
          ),
        )}
      </View>

      {selected && (
        <View style={{ marginTop: 8 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            Drops on {selected.dateKey}
          </Text>
          {selected.drops.map((drop) => (
            <View
              key={`${drop.productId}-${drop.from}-${drop.to}`}
              style={{ flexDirection: "row", paddingVertical: 3, gap: 8 }}
            >
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
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {formatPrice(drop.from, "USD")} →{" "}
                {formatPrice(drop.to, "USD")}
              </Text>
              <Text
                style={{
                  color: colors.success,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {drop.percent.toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});
DropCalendarCard.displayName = "DropCalendarCard";
