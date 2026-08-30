import { Text, View, TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@/lib/currency";
import type {
  MoversResult,
  MoversWindow,
  PriceMove,
} from "@/lib/watchlist-stats";

const WINDOWS: Array<{ label: string; value: MoversWindow }> = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "All", value: null },
];

function MoveRow({ move, color }: { move: PriceMove; color: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 14 }}>{move.countryFlag}</Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.foreground, fontSize: 14, fontWeight: "500" }}
          numberOfLines={1}
        >
          {move.productName}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
          {move.distributorName} · {formatPrice(move.oldPrice, move.currency)} →{" "}
          {formatPrice(move.newPrice, move.currency)}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: color + "22",
          borderRadius: 10,
          paddingHorizontal: 8,
          paddingVertical: 3,
        }}
      >
        <Text style={{ color, fontSize: 12, fontWeight: "700" }}>
          {move.changePct > 0 ? "+" : ""}
          {move.changePct}%
        </Text>
      </View>
    </View>
  );
}

export function MoversCard({
  movers,
  days,
  onDaysChange,
}: {
  movers: MoversResult;
  days: MoversWindow;
  onDaysChange: (days: MoversWindow) => void;
}) {
  const colors = useColors();
  const empty = movers.drops.length === 0 && movers.gainers.length === 0;

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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 13 }}>Biggest Movers</Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {WINDOWS.map((w) => (
            <TouchableOpacity
              key={w.label}
              onPress={() => {
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onDaysChange(w.value);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
                backgroundColor:
                  days === w.value ? colors.primary : "transparent",
              }}
              accessibilityLabel={`Show ${w.label} movers`}
              accessibilityRole="radio"
              accessibilityState={{ selected: days === w.value }}
            >
              <Text
                style={{
                  color: days === w.value ? "#fff" : colors.muted,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {w.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {empty ? (
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          Not enough price history yet.
        </Text>
      ) : (
        <>
          {movers.drops.length > 0 && (
            <Text
              style={{
                color: colors.success,
                fontSize: 12,
                fontWeight: "600",
                marginTop: 4,
              }}
            >
              ▼ Top Drops
            </Text>
          )}
          {movers.drops.map((move) => (
            <MoveRow
              key={`${move.productId}-${move.distributorId}`}
              move={move}
              color={colors.success}
            />
          ))}
          {movers.gainers.length > 0 && (
            <Text
              style={{
                color: colors.error,
                fontSize: 12,
                fontWeight: "600",
                marginTop: 8,
              }}
            >
              ▲ Top Gainers
            </Text>
          )}
          {movers.gainers.map((move) => (
            <MoveRow
              key={`${move.productId}-${move.distributorId}`}
              move={move}
              color={colors.error}
            />
          ))}
        </>
      )}
    </View>
  );
}
