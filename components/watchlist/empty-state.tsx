import { Text, View, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { StatusFilter } from "@/lib/watchlist-org";

export function EmptyState({
  query,
  statusFilter,
  regionFilter,
  selectedTagIds,
  onClearFilters,
  onAddProduct,
}: {
  query: string;
  statusFilter: StatusFilter;
  regionFilter: string;
  selectedTagIds: string[];
  onClearFilters: () => void;
  onAddProduct: () => void;
}) {
  const colors = useColors();

  const hasFilters =
    regionFilter !== "all" ||
    selectedTagIds.length > 0 ||
    statusFilter !== "all" ||
    query.trim().length > 0;

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 60,
        paddingHorizontal: 20,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.primary + "14",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.primary + "22",
        }}
      >
        <IconSymbol
          name={hasFilters ? "line.3.horizontal.decrease.circle" : "list.bullet"}
          size={36}
          color={hasFilters ? colors.muted : colors.primary}
        />
      </View>
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "600",
          fontSize: 18,
          marginTop: 16,
          textAlign: "center",
        }}
      >
        {hasFilters ? "No products match your filters" : "No products yet"}
      </Text>
      <Text
        style={{
          color: colors.muted,
          fontSize: 14,
          textAlign: "center",
          marginTop: 8,
          lineHeight: 20,
        }}
      >
        {hasFilters
          ? "Try adjusting your filters or search — or add a new product to track."
          : "Add products to track their availability and prices globally across 25 distributors."}
      </Text>
      {!hasFilters && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            marginTop: 14,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <IconSymbol name="lightbulb.fill" size={16} color={colors.warning} />
          <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
            Tip: Search for MikroTik CRS, Ubiquiti U7, RTX 4090, Pi 5, etc.
          </Text>
        </View>
      )}
      {hasFilters ? (
        <TouchableOpacity activeOpacity={0.85}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 20,
            paddingHorizontal: 24,
            paddingVertical: 12,
            marginTop: 20,
          }}
          onPress={onClearFilters}
          accessibilityLabel="Clear filters"
          accessibilityRole="button"
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
            Clear Filters
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity activeOpacity={0.85}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 20,
            paddingHorizontal: 24,
            paddingVertical: 12,
            marginTop: 20,
          }}
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAddProduct();
          }}
          accessibilityLabel="Add product"
          accessibilityRole="button"
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
            Browse Products
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
