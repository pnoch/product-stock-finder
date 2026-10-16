import { memo, useState, useMemo, useCallback } from "react";
import { Text, View, TouchableOpacity, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@shared/currency";
import { dateKey, buildGridCells } from "@/lib/drop-calendar";
import type {
  DropCalendarResult,
  DropDay,
} from "@/lib/drop-calendar";

export { buildGridCells };

export const DropCalendarCard = memo(function DropCalendarCard({
  result,
  days,
  displayCurrency,
  now: nowProp,
}: {
  result: DropCalendarResult;
  days: number;
  displayCurrency: string;
  now?: number;
}) {
  const colors = useColors();
  const { width: windowWidth } = useWindowDimensions();
  const cellSize = useMemo(() => {
    const available = windowWidth - 32 - 32 - 6 * 4;
    const ideal = Math.floor(available / 7);
    // Cap so a tablet doesn't get absurd cells, but high enough that a phone
    // fills the row: a lower cap left the 7-cell header narrower than the
    // wrapping grid, which then packed 9 cells per row.
    return Math.max(28, Math.min(48, ideal));
  }, [windowWidth]);
  const [now, setNow] = useState(() => nowProp ?? Date.now());
  useFocusEffect(
    useCallback(() => {
      setNow(nowProp ?? Date.now());
    }, [nowProp]),
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const cells = useMemo(() => buildGridCells(days, now), [days, now]);
  // Chunk into explicit weeks so the grid always has 7 columns and lines up
  // with the weekday header (a wrapping row packed more than 7 on wide phones).
  const gridRows = useMemo(() => {
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cells]);
  const selected: DropDay | undefined = useMemo(
    () => (selectedKey ? result.byDay.get(selectedKey) : undefined),
    [selectedKey, result.byDay],
  );
  const handleSelect = useCallback(
    (ts: number) => {
      const key = dateKey(ts);
      setSelectedKey((prev) => (prev === key ? null : key));
    },
    [],
  );

  const cellStyle = (ts: number) => {
    const key = dateKey(ts);
    const day = result.byDay.get(key);
    const isToday = key === dateKey(now);
    const isSelected = key === selectedKey;
    const base = {
      width: cellSize,
      height: cellSize,
      borderRadius: 8,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 4,
    };
    let style: typeof base & { backgroundColor: string; borderColor: string; borderWidth: number };
    if (!day) {
      style = { ...base, backgroundColor: "transparent", borderColor: colors.border, borderWidth: 1 };
    } else {
      const intensity =
        day.dropCount >= 3 ? colors.success : colors.success + "55";
      style = {
        ...base,
        backgroundColor: intensity,
        borderColor: isToday ? colors.primary : colors.success,
        borderWidth: 1,
      };
    }
    if (isSelected) {
      return {
        ...style,
        backgroundColor: day ? colors.primary : colors.primary + "18",
        borderColor: colors.primary,
        borderWidth: 2,
      };
    }
    return style;
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
              width: cellSize,
              textAlign: "center",
            }}
          >
            {d}
          </Text>
        ))}
      </View>

      <View>
        {gridRows.map((row, ri) => (
          <View key={ri} testID={`drop-cal-row-${ri}`} style={{ flexDirection: "row", gap: 4 }}>
            {row.map((ts, i) =>
              ts === null ? (
                <View
                  key={`blank-${ri}-${i}`}
                  style={{ width: cellSize, height: cellSize, marginBottom: 4 }}
                />
              ) : (
                <TouchableOpacity
                  activeOpacity={result.byDay.get(dateKey(ts)) ? 0.7 : 1}
                  key={ts}
                  disabled={!result.byDay.get(dateKey(ts))}
                  onPress={() => handleSelect(ts)}
                  style={cellStyle(ts)}
                  accessibilityLabel={
                    result.byDay.get(dateKey(ts))
                      ? `Price drops on ${new Date(ts).toLocaleDateString()}`
                      : `${new Date(ts).toLocaleDateString()}, no price drops`
                  }
                  accessibilityRole={result.byDay.get(dateKey(ts)) ? "button" : "text"}
                >
                  <Text style={{ color: colors.foreground, fontSize: 11 }}>
                    {new Date(ts).getDate()}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
        ))}
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
              key={`${drop.productId}-${drop.distributorId}-${drop.from}-${drop.to}`}
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
                {formatPrice(drop.from, displayCurrency)} →{" "}
                {formatPrice(drop.to, displayCurrency)}
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
