import { memo, useCallback, useMemo } from "react";
import { Text, View, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { formatPrice } from "@shared/currency";
import { getDistributorById } from "@shared/distributors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { CHART_COLORS, SortBy } from "@/lib/compare-utils";

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface DistributorSelectorProps {
  sortedListings: DistributorListing[];
  selected: Set<string>;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  onToggle: (distributorId: string) => void;
  priceTrends: Map<string, { pct: number; dir: "up" | "down" | "flat" }>;
}

// ─── Distributor Selector ──────────────────────────────────────────────────────
export const DistributorSelector = memo(function DistributorSelector({
  sortedListings,
  selected,
  sortBy,
  onSortChange,
  onToggle,
  priceTrends,
}: DistributorSelectorProps) {
  const colors = useColors();

  const allDistributorIds = useMemo(
    () =>
      sortedListings
        .filter((l) => l.priceHistory && l.priceHistory.length >= 2)
        .map((l) => l.distributorId)
        .sort(),
    [sortedListings],
  );

  void allDistributorIds;

  const handleSort = useCallback(
    (s: SortBy) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSortChange(s);
    },
    [onSortChange],
  );

  const handleToggle = useCallback(
    (distributorId: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onToggle(distributorId);
    },
    [onToggle],
  );

  return (
    <View style={{ paddingHorizontal: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            color: colors.foreground,
            fontWeight: "700",
            fontSize: 15,
          }}
        >
          Select Distributors ({selected.size}/5)
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {(["trend", "price", "name"] as SortBy[]).map((s) => (
            <TouchableOpacity activeOpacity={0.85}
              key={s}
              onPress={() => handleSort(s)}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor:
                  sortBy === s ? colors.primary : colors.border + "44",
              }}
              accessibilityLabel={`Sort by ${s}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: sortBy === s }}
            >
              <Text
                style={{
                  color: sortBy === s ? "#fff" : colors.foreground,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {s === "trend"
                  ? "Trend ▼"
                  : s === "price"
                    ? "Price"
                    : "A–Z"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {sortedListings.map((l) => {
        const distributor = getDistributorById(l.distributorId);
        const isSelected = selected.has(l.distributorId);
        const hasHistory = l.priceHistory && l.priceHistory.length >= 2;
        const chipColor = isSelected
          ? CHART_COLORS[hashId(l.distributorId) % CHART_COLORS.length]
          : colors.border;
        const trend = priceTrends.get(l.distributorId);
        return (
          <TouchableOpacity activeOpacity={0.7}
            key={l.distributorId}
            onPress={() => handleToggle(l.distributorId)}
            disabled={!hasHistory && !isSelected}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: isSelected
                ? chipColor + "18"
                : colors.surface,
              borderRadius: 16,
              padding: 16,
              marginBottom: 8,
              borderWidth: 1.5,
              borderColor: isSelected ? chipColor : colors.border,
              opacity: !hasHistory && !isSelected ? 0.45 : 1,
            }}
            accessibilityLabel={`${isSelected ? "Deselect" : "Select"} ${distributor?.name ?? l.distributorId}${!hasHistory && !isSelected ? " — no price history" : ""}`}
            accessibilityHint={!hasHistory && !isSelected ? "No price history — cannot compare" : undefined}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected, disabled: !hasHistory && !isSelected }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: isSelected ? chipColor : colors.border,
                backgroundColor: isSelected ? chipColor : "transparent",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              {isSelected && (
                <IconSymbol name="checkmark" size={12} color="#fff" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                {distributor?.countryFlag}{" "}
                {distributor?.name ?? l.distributorId}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {hasHistory
                  ? `${l.priceHistory!.length} price points`
                  : "No price history"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{
                  color: isSelected ? chipColor : colors.foreground,
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                {formatPrice(l.price, l.currency)}
              </Text>
              {trend && trend.dir !== "flat" && (
                <Text
                  style={{
                    color:
                      trend.dir === "down"
                        ? colors.success
                        : colors.error,
                    fontSize: 11,
                    fontWeight: "600",
                    marginTop: 1,
                  }}
                >
                  {trend.dir === "down" ? "▼" : "▲"}{" "}
                  {trend.pct.toFixed(1)}%
                </Text>
              )}
              <View
                style={{
                  backgroundColor:
                    l.stockStatus === "in_stock"
                      ? colors.success + "22"
                      : l.stockStatus === "back_order"
                        ? colors.warning + "22"
                        : l.stockStatus === "out_of_stock"
                          ? colors.error + "22"
                          : colors.muted + "22",
                  borderRadius: 8,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  marginTop: 2,
                }}
              >
                <Text
                  style={{
                    color:
                      l.stockStatus === "in_stock"
                        ? colors.success
                        : l.stockStatus === "back_order"
                          ? colors.warning
                          : l.stockStatus === "out_of_stock"
                            ? colors.error
                            : colors.muted,
                    fontSize: 10,
                    fontWeight: "600",
                  }}
                >
                  {l.stockStatus === "in_stock"
                    ? "In Stock"
                    : l.stockStatus === "back_order"
                      ? "Back Order"
                      : l.stockStatus === "unknown"
                        ? "Unknown"
                        : "Out of Stock"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
     </View>
  );
});
DistributorSelector.displayName = "DistributorSelector";
