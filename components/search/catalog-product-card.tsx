import { memo, useCallback, useMemo } from "react";
import { Text, View, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProductImage } from "@/components/search/product-image";
import { Product } from "@/lib/types";

interface CatalogProductCardProps {
  product: Product;
  isTracked: boolean;
  isAdding: boolean;
  onAdd: (item: Product) => void;
  onTagPress: (item: Product) => void;
}

export const CatalogProductCard = memo(function CatalogProductCard({
  product,
  isTracked,
  isAdding,
  onAdd,
  onTagPress,
}: CatalogProductCardProps) {
  const colors = useColors();
  const containerStyle = useMemo(() => ({
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    minHeight: 78,
  }), [colors.surface, colors.border]);
  const handleAdd = useCallback(() => onAdd(product), [onAdd, product]);
  const handleTag = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTagPress(product);
  }, [onTagPress, product]);

  return (
    <View style={containerStyle}>
      <ProductImage productId={product.id} />
      <View style={{ flex: 1, marginRight: 12, justifyContent: "center" }}>
        <Text
          style={{
            color: colors.foreground,
            fontWeight: "600",
            fontSize: 15,
          }}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {product.name}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }} numberOfLines={1} ellipsizeMode="tail">
          {product.modelNumber}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 4,
            gap: 6,
          }}
        >
          <View
            style={{
              backgroundColor: colors.primary + "22",
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 11,
                fontWeight: "600",
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {product.brand}
            </Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 11, flexShrink: 1 }} numberOfLines={1} ellipsizeMode="tail">
            {product.category}
          </Text>
        </View>
      </View>
      {!isTracked && (
        <TouchableOpacity activeOpacity={0.85}
          onPress={handleTag}
          style={{
            marginRight: 8,
            padding: 6,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
          hitSlop={8}
          accessibilityLabel="Add tags"
          accessibilityRole="button"
        >
          <IconSymbol name="tag.fill" size={20} color={colors.muted} />
        </TouchableOpacity>
      )}
      <TouchableOpacity activeOpacity={0.85}
        onPress={handleAdd}
        disabled={isAdding || isTracked}
        style={{
          backgroundColor: isTracked ? colors.success : colors.primary,
          opacity: isAdding || isTracked ? 0.5 : 1,
          borderRadius: 20,
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
        }}
        hitSlop={8}
        accessibilityLabel={isTracked ? "Already in watchlist" : "Add to watchlist"}
        accessibilityRole="button"
      >
        {isAdding ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : isTracked ? (
          <IconSymbol name="checkmark" size={20} color="#fff" />
        ) : (
          <IconSymbol name="plus" size={20} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
});
CatalogProductCard.displayName = "CatalogProductCard";
