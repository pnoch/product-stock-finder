import {
  Platform,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatPrice } from "@shared/currency";
import type { WatchlistSummary } from "@/lib/watchlist-summary";
import type { StatusFilter } from "@/lib/watchlist-org";

export function SummaryCard({
  summary,
  displayCurrency,
  statusFilter,
  onStatusToggle,
  onViewStats,
}: {
  summary: WatchlistSummary;
  displayCurrency: string;
  statusFilter: StatusFilter;
  onStatusToggle: (status: StatusFilter) => void;
  onViewStats: () => void;
}) {
  const colors = useColors();

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
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          All Listings Value
        </Text>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 22,
            fontWeight: "700",
          }}
        >
          {formatPrice(summary.totalValue, displayCurrency)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
        {(
          [
            {
              key: "in_stock",
              label: "In Stock",
              value: summary.inStock,
              color: colors.success,
            },
            {
              key: "back_order",
              label: "Back Order",
              value: summary.backOrder,
              color: colors.warning,
            },
            {
              key: "out_of_stock",
              label: "Out of Stock",
              value: summary.outOfStock,
              color: colors.error,
            },
          ] as const
        ).map((col) => (
          <TouchableOpacity activeOpacity={0.7}
            key={col.key}
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onStatusToggle(statusFilter === col.key ? "all" : col.key);
            }}
            style={{
              flex: 1,
              borderRadius: 10,
              paddingVertical: 4,
              paddingHorizontal: 6,
              backgroundColor:
                statusFilter === col.key
                  ? col.color + "22"
                  : "transparent",
            }}
            accessibilityLabel={`Filter by ${col.label}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: statusFilter === col.key }}
          >
            <Text
              style={{ color: col.color, fontSize: 16, fontWeight: "600" }}
            >
              {col.value}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {col.label}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {summary.listingCount}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Listings
          </Text>
        </View>
      </View>
      <TouchableOpacity activeOpacity={0.7}
        onPress={() => {
          if (Platform.OS !== "web")
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onViewStats();
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
        accessibilityLabel="View statistics"
        accessibilityRole="button"
      >
        <Text
          style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}
        >
          View statistics
        </Text>
        <IconSymbol name="chevron.right" size={12} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}
