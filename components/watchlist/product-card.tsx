import { memo, useState, useEffect, useMemo, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Pressable,
  Animated,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { Product, TagDefinition } from "@/lib/types";
import { formatPrice } from "@shared/currency";
import { StockBadge } from "@/components/stock-badge";
import { ScarcityBadge } from "@/components/watchlist/scarcity-badge";
import { PriceSparkline } from "@/components/price-sparkline";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProductImage } from "@/components/search/product-image";
import { openListingUrl } from "@/lib/listing-utils";
import { isAcquired } from "@/lib/acquired";
import { useProductCardDerived } from "@/hooks/use-product-card-derived";
import { ProductCardTags } from "./product-card-tags";
import { ProductCardInsights } from "./product-card-insights";
import { ProductCardFooter } from "./product-card-footer";
import type { DealScore } from "@/lib/deal-score";

export const ProductCard = memo(function ProductCard({
  product,
  onPress,
  onDelete,
  onTagPress,
  tagDefinitions,
  selectionMode = false,
  selected = false,
  onLongPress,
  insight,
  dealScore,
  displayCurrency,
  onFindPrices,
  findingPrices = false,
  onToggleAcquired,
}: {
  product: Product;
  onPress: () => void;
  onDelete: () => void;
  onTagPress: () => void;
  tagDefinitions: Record<string, TagDefinition>;
  selectionMode?: boolean;
  selected?: boolean;
  onLongPress?: () => void;
  insight?: { atAllTimeLow: boolean; dropStreak: number };
  dealScore?: DealScore | null;
  displayCurrency?: string;
  onFindPrices?: () => void;
  findingPrices?: boolean;
  onToggleAcquired?: () => void;
}) {
  const colors = useColors();
  const acquired = isAcquired(product);
  const cardOpacity = useState(() => new Animated.Value(acquired ? 0.55 : 1))[0];
  useEffect(() => {
    Animated.timing(cardOpacity, {
      toValue: acquired ? 0.55 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [acquired, cardOpacity]);
  const handleToggleAcquired = useCallback(
    (e?: { stopPropagation?: () => void }) => {
      if (Platform.OS === "web") e?.stopPropagation?.();
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onToggleAcquired?.();
    },
    [onToggleAcquired],
  );
  const {
    showInsightRow,
    bestPrice,
    bestInStockListing,
    bestStatus,
    availability,
    distributorCount,
    validTags,
    priceChange,
    sparklineData,
    refreshColorKey,
  } = useProductCardDerived({
    product,
    tagDefinitions,
    insight,
    dealScore,
    displayCurrency,
  });
  const pressScale = useState(() => new Animated.Value(1))[0];
  const sparklineOpacity = useState(() => new Animated.Value(1))[0];
  const selectionAnim = useState(() => new Animated.Value(selectionMode ? 1 : 0))[0];
  const selectedPop = useState(() => new Animated.Value(selected ? 1 : 0))[0];
  const selectedScale = selectedPop.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.015],
  });
  const cardStyle = useMemo(
    () => ({
      backgroundColor: selected ? colors.primary + "0F" : colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: selected ? 2 : selectionMode ? 2 : 1,
      borderColor: selected
        ? colors.primary
        : selectionMode
          ? colors.primary + "55"
          : colors.border,
      transform: [{ scale: Animated.multiply(pressScale, selectedScale) }] as unknown as never,
      shadowColor: selected ? colors.primary : "transparent",
      shadowOpacity: selected ? 0.12 : 0,
      shadowRadius: selected ? 8 : 0,
      shadowOffset: { width: 0, height: 2 },
      elevation: selected ? 2 : 0,
    }),
    [colors.primary, colors.surface, colors.border, selected, selectionMode, pressScale, selectedScale],
  );
  const handleTagPress = useCallback(
    (e?: { stopPropagation?: () => void }) => {
      if (Platform.OS === "web") e?.stopPropagation?.();
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onTagPress();
    },
    [onTagPress],
  );
  const handleDeletePress = useCallback(
    (e?: { stopPropagation?: () => void }) => {
      if (Platform.OS === "web") e?.stopPropagation?.();
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onDelete();
    },
    [onDelete],
  );
  useEffect(() => {
    sparklineOpacity.setValue(0.55);
    Animated.timing(sparklineOpacity, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [product.id, sparklineOpacity]);

  useEffect(() => {
    Animated.spring(selectionAnim, {
      toValue: selectionMode ? 1 : 0,
      useNativeDriver: true,
      tension: 140,
      friction: 12,
    }).start();
  }, [selectionMode, selectionAnim]);

  useEffect(() => {
    Animated.spring(selectedPop, {
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
      tension: 220,
      friction: 10,
    }).start();
  }, [selected, selectedPop]);

  const handlePressIn = useCallback(() => {
    Animated.spring(pressScale, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }, [pressScale]);
  const handlePressOut = useCallback(() => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 22,
      bounciness: 4,
    }).start();
  }, [pressScale]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // Not an accessibility element: aggregating the whole card would hide the
      // nested Find/tag/delete buttons from VoiceOver/TalkBack. The product name
      // below is the accessible "open" control instead.
      accessible={false}
    >
      <Animated.View style={[cardStyle, { opacity: cardOpacity }]}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        {selectionMode && (
          <Animated.View
            style={{
              width: 26,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
              opacity: selectionAnim,
              transform: [
                {
                  scale: selectionAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                },
              ],
            }}
          >
            <Animated.View
              style={{
                transform: [{ scale: selectedPop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
              }}
            >
              <IconSymbol
                name={selected ? "checkmark.circle.fill" : "circle.fill"}
                size={22}
                color={selected ? colors.primary : colors.muted}
              />
            </Animated.View>
          </Animated.View>
        )}
        <ProductImage productId={product.id} size={48} marginRight={10} />
        <View style={{ flex: 1, marginRight: 10 }}>
          <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={350}
            accessibilityLabel={[
              product.name,
              bestPrice ? formatPrice(bestPrice.price, bestPrice.currency) : null,
              // Derive from the same value the badge renders: the inline rollup
              // here announced "out of stock" for an all-unknown product whose
              // badge says "Unknown".
              bestStatus === "in_stock"
                ? "in stock"
                : bestStatus === "back_order"
                  ? "back order"
                  : bestStatus === "unknown"
                    ? "unknown"
                    : "out of stock",
            ]
              .filter(Boolean)
              .join(", ")}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityHint={
              selectionMode
                ? selected
                  ? "Double tap to deselect"
                  : "Double tap to select"
                : "Double tap to open"
            }
          >
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "700",
                fontSize: 15,
              }}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {product.name}
            </Text>
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }} numberOfLines={1} ellipsizeMode="tail">
             {product.marketplace ? `${product.marketplace.platform === "lazada" ? "Lazada TH" : "Shopee TH"} · ${product.marketplace.variant}` : product.modelNumber}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1} ellipsizeMode="tail">
             {product.marketplace ? `${product.marketplace.seller} · Manual price` : `${product.brand} · ${product.category}`}
          </Text>
          {!product.marketplace && (product.listings ?? []).length === 0 && onFindPrices && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={(e) => {
                if (Platform.OS === "web") e?.stopPropagation?.();
                onFindPrices();
              }}
              disabled={findingPrices}
              hitSlop={8}
              accessibilityLabel="No prices — find prices"
              accessibilityRole="button"
              style={{ alignSelf: "flex-start", marginTop: 6, opacity: findingPrices ? 0.5 : 1 }}
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>
                {findingPrices ? "Finding prices…" : "No prices — Find"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <StockBadge status={bestStatus} />
          {availability && <ScarcityBadge scarcity={availability.scarcity} />}
          {bestPrice && (
            <Text
              style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}
            >
              {formatPrice(bestPrice.price, bestPrice.currency)}
            </Text>
          )}
          {bestInStockListing && (
            <TouchableOpacity
              activeOpacity={0.85}
              accessibilityLabel={`Buy ${product.name} at the cheapest in-stock store`}
              accessibilityRole="button"
              onPress={(e) => {
                e?.stopPropagation?.();
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                void openListingUrl(bestInStockListing.url);
              }}
              style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
                backgroundColor: colors.primary + "22",
              }}
            >
              <IconSymbol name="cart.fill" size={13} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 12 }}>Buy</Text>
            </TouchableOpacity>
          )}
          {sparklineData && (
            <PriceSparkline data={sparklineData} width={64} height={24} />
          )}
          {priceChange && (
            <Animated.Text
              style={{
                color: priceChange.isDown ? colors.success : colors.error,
                fontSize: 11,
                fontWeight: "600",
                opacity: sparklineOpacity,
              }}
            >
              {priceChange.isDown ? "▼" : "▲"} {Math.abs(priceChange.pct).toFixed(1)}%
            </Animated.Text>
          )}
        </View>
      </View>
      <ProductCardTags
        colors={colors}
        validTags={validTags}
        tagDefinitions={tagDefinitions}
      />
      {showInsightRow && (
        <ProductCardInsights
          colors={colors}
          insight={insight}
          dealScore={dealScore}
          hasTags={validTags.length > 0}
        />
      )}
      <ProductCardFooter
        colors={colors}
        product={product}
        distributorCount={distributorCount}
        refreshColorKey={refreshColorKey}
        acquired={acquired}
        onToggleAcquired={onToggleAcquired}
        onToggleAcquiredPress={handleToggleAcquired}
        onTagPress={handleTagPress}
        onDeletePress={handleDeletePress}
      />
      </Animated.View>
    </Pressable>
  );
});
ProductCard.displayName = "ProductCard";
