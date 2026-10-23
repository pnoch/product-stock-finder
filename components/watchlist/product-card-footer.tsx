import { Text, View } from "react-native";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { formatLastRefreshed } from "@/lib/last-refreshed";
import type { Product } from "@/lib/types";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function ProductCardFooter({
  colors,
  product,
  distributorCount,
  refreshColorKey,
  acquired,
  onToggleAcquired,
  onToggleAcquiredPress,
  onTagPress,
  onDeletePress,
}: {
  colors: Colors;
  product: Product;
  distributorCount: number;
  refreshColorKey: "green" | "yellow" | "red" | "gray";
  acquired: boolean;
  onToggleAcquired?: () => void;
  onToggleAcquiredPress: (e?: { stopPropagation?: () => void }) => void;
  onTagPress: (e?: { stopPropagation?: () => void }) => void;
  onDeletePress: (e?: { stopPropagation?: () => void }) => void;
}) {
  const colorMap = {
    green: colors.success,
    yellow: colors.warning,
    red: colors.error,
    gray: colors.muted,
  };
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        {distributorCount} distributor{distributorCount !== 1 ? "s" : ""} tracked
      </Text>
      <Text style={{ color: colorMap[refreshColorKey], fontSize: 11 }}>
        Updated {formatLastRefreshed(product.lastRefreshed)}
      </Text>
      {onToggleAcquired && (
        <IconActionButton
          name="checkmark.circle.fill"
          size={16}
          color={acquired ? colors.success : colors.muted}
          onPress={onToggleAcquiredPress}
          accessibilityLabel={acquired ? "Mark as not acquired" : "Mark as acquired"}
          accessibilityState={{ selected: acquired }}
          style={{ marginRight: 4 }}
        />
      )}
      <IconActionButton
        name="tag.fill"
        size={16}
        color={(product.tags?.length ?? 0) > 0 ? colors.primary : colors.muted}
        onPress={onTagPress}
        accessibilityLabel="Edit tags"
        style={{ marginRight: 4 }}
      />
      <IconActionButton
        name="trash.fill"
        size={16}
        color={colors.error}
        onPress={onDeletePress}
        accessibilityLabel="Delete product"
        accessibilityHint="Removes this product from your watchlist"
      />
    </View>
  );
}
