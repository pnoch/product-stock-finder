import { memo, useCallback } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { formatPrice } from "@shared/currency";
import type { TrendingProduct } from "@/lib/types";
import { useColors } from "@/hooks/use-colors";
import { ProductImage } from "@/components/search/product-image";

export const TrendingProductRow = memo(function TrendingProductRow({
  product,
  isInWatchlist,
  onAdd,
  onPress,
}: {
  product: TrendingProduct;
  isInWatchlist: boolean;
  onAdd: (p: TrendingProduct) => void;
  onPress: (p: TrendingProduct) => void;
}) {
  const colors = useColors();
  const handlePress = useCallback(() => onPress(product), [onPress, product]);
  const handleAddPress = useCallback(
    (e: unknown) => {
      (e as { stopPropagation?: () => void })?.stopPropagation?.();
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onAdd(product);
    },
    [onAdd, product],
  );
  return (
    <Pressable
      onPress={handlePress}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
      accessibilityLabel={`View ${product.name}`}
      accessibilityRole="button"
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <ProductImage productId={product.id} size={40} />
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: colors.foreground,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {product.name}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.muted,
              marginTop: 2,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {product.category} · {product.brand} ·{" "}
            {formatPrice(product.estimatedPrice, product.currency)}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.muted,
              marginTop: 4,
              fontStyle: "italic",
            }}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {product.reason}
          </Text>
        </View>
        <Pressable
          onPress={handleAddPress}
          disabled={isInWatchlist}
          style={{
            backgroundColor: isInWatchlist ? colors.muted : colors.primary,
            opacity: isInWatchlist ? 0.6 : 1,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 6,
            marginLeft: 8,
          }}
          accessibilityLabel={isInWatchlist ? "Already in watchlist" : "Add to watchlist"}
          accessibilityRole="button"
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            {isInWatchlist ? "In Watchlist" : "Add"}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
});
TrendingProductRow.displayName = "TrendingProductRow";
