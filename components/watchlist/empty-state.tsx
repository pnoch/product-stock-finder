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
        paddingTop: 80,
      }}
    >
      <IconSymbol name="list.bullet" size={48} color={colors.muted} />
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "600",
          fontSize: 18,
          marginTop: 16,
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
        }}
      >
        {hasFilters
          ? "Try clearing your filters or adding products"
          : "Add products to track their availability and prices globally"}
      </Text>
      {hasFilters ? (
        <TouchableOpacity
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
        <TouchableOpacity
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
            Add Product
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
