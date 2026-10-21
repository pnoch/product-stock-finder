import { Pressable, Text, View } from "react-native";
import { formatPrice } from "@shared/currency";
import { useColors } from "@/hooks/use-colors";
import { StockBadge } from "@/components/stock-badge";
import { formatLastRefreshed } from "@/lib/last-refreshed";

export type Row = {
  id: string;
  name: string;
  brand: string;
  category: string;
  modelNumber?: string;
  price: number;
  currency: string;
  storeCount: number;
  /** Epoch ms the price was cached; undefined for the standalone fallback. */
  fetchedAt?: number;
};


export function AvailableRow({ row, onPress }: { row: Row; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${row.name}`}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}
          >
            {row.name}
          </Text>
          <Text
            style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}
            numberOfLines={1}
          >
            {formatPrice(row.price, row.currency)} · in stock at {row.storeCount}{" "}
            {row.storeCount === 1 ? "store" : "stores"}
          </Text>
          {row.fetchedAt != null && Number.isFinite(row.fetchedAt) && (
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
              as of {formatLastRefreshed(new Date(row.fetchedAt).toISOString())}
            </Text>
          )}
        </View>
        <StockBadge status="in_stock" />
      </View>
    </Pressable>
  );
}

