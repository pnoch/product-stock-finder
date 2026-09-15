import { memo, useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { convertPrice, getBestPrice } from "@/lib/currency";
import { StockBadge } from "@/components/stock-badge";
import { PriceSparkline } from "@/components/price-sparkline";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { fetchProductImage } from "@/lib/server-images";
import {
  formatLastRefreshed,
  getLastRefreshedColor,
} from "@/lib/last-refreshed";
import { getTagById } from "@/lib/tags";
import { productStatus } from "@/lib/watchlist-org";
import type { DealScore } from "@/lib/deal-score";
import { dealBandLabel } from "@/lib/deal-score";

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
}) {
  const colors = useColors();
  const currency = displayCurrency ?? "USD";
  const showInsightRow =
    (insight != null && (insight.atAllTimeLow || insight.dropStreak >= 2)) ||
    (dealScore != null && dealScore.band === "hot");
  const bestPrice = useMemo(
    () => getBestPrice(product.listings ?? [], currency),
    [product.listings, currency],
  );
  const bestStatus = useMemo(() => productStatus(product), [product]);
  const distributorCount = product.listings?.length ?? 0;
  const validTags = useMemo(
    () => (product.tags ?? []).filter((id) => getTagById(tagDefinitions, id)),
    [product.tags, tagDefinitions],
  );
  const priceChange = useMemo(() => {
    if (!bestPrice) return null;
    const allHistory = (product.listings ?? []).flatMap(
      (l) => l.priceHistory ?? [],
    );
    if (allHistory.length < 2) return null;
    const sorted = [...allHistory].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    // Percentage is a ratio, so currency cancels out — converting oldest to displayCurrency yields the same pct as converting both.
    const oldestUsd = convertPrice(
      sorted[0].price,
      sorted[0].currency,
      currency,
    );
    const currentUsd = bestPrice.price;
    if (oldestUsd === null || oldestUsd <= 0) return null;
    const pct = ((currentUsd - oldestUsd) / oldestUsd) * 100;
    if (Math.abs(pct) < 0.5) return null;
    return { pct, isDown: pct < 0 };
  }, [bestPrice, product.listings, currency]);
  const sparklineData = useMemo(() => {
    // Convert each listing's history into the display currency before
    // flattening: mixing raw USD and MYR points draws a meaningless chart that
    // contradicts the converted "Best Price" next to it.
    const all = (product.listings ?? []).flatMap((l) =>
      (l.priceHistory ?? []).map((p) => {
        const converted = convertPrice(p.price, p.currency, currency);
        return converted === null ? null : { ...p, price: converted, currency };
      }),
    ).filter((p): p is NonNullable<typeof p> => p !== null);
    if (all.length < 2) return null;
    return all;
  }, [product.listings, currency]);
  const refreshColorKey = useMemo(
    () => getLastRefreshedColor(product.lastRefreshed),
    [product.lastRefreshed],
  );
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const sparklineOpacity = useRef(new Animated.Value(1)).current;
  const selectionAnim = useRef(new Animated.Value(selectionMode ? 1 : 0)).current;
  const selectedPop = useRef(new Animated.Value(selected ? 1 : 0)).current;
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
    (e: { stopPropagation?: () => void }) => {
      if (Platform.OS === "web") e?.stopPropagation?.();
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onTagPress();
    },
    [onTagPress],
  );
  const handleDeletePress = useCallback(
    (e: { stopPropagation?: () => void }) => {
      if (Platform.OS === "web") e?.stopPropagation?.();
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onDelete();
    },
    [onDelete],
  );
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    Animated.timing(imageOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [imageOpacity]);
  const handleImageError = useCallback(() => setImageError(true), []);
  useEffect(() => {
    let active = true;
    setImageUrl(null);
    setImageError(false);
    setImageLoaded(false);
    imageOpacity.setValue(0);
    fetchProductImage(product.id)
      .then((res) => {
        if (active && res) setImageUrl(res.imageUrl);
        else if (active) setImageUrl(null);
      })
      .catch(() => {
        if (active) setImageUrl(null);
      });
    return () => {
      active = false;
    };
  }, [product.id, imageOpacity]);

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
      accessibilityLabel={product.name}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityHint={selectionMode ? (selected ? "Double tap to deselect" : "Double tap to select") : undefined}
    >
      <Animated.View style={cardStyle}>
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
        {imageUrl && !imageError ? (
          <View style={{ width: 48, height: 48, borderRadius: 8, marginRight: 10, overflow: "hidden", backgroundColor: colors.border + "66", borderWidth: 1, borderColor: colors.border }}>
            {!imageLoaded && (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
                <IconSymbol name="photo" size={18} color={colors.muted + "66"} />
              </View>
            )}
            <Animated.Image
              source={{ uri: imageUrl }}
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{ width: 48, height: 48, borderRadius: 8, opacity: imageOpacity }}
              resizeMode="cover"
            />
          </View>
        ) : (
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              marginRight: 10,
              backgroundColor: colors.border + "66",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <IconSymbol name="photo" size={18} color={colors.muted} />
          </View>
        )}
        <View style={{ flex: 1, marginRight: 10 }}>
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
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }} numberOfLines={1} ellipsizeMode="tail">
            {product.modelNumber}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1} ellipsizeMode="tail">
            {product.brand} · {product.category}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <StockBadge status={bestStatus} />
          {bestPrice && (
            <Text
              style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}
            >
              {formatPrice(bestPrice.price, bestPrice.currency)}
            </Text>
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
      {validTags.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 10,
          }}
        >
          {validTags.slice(0, 3).map((id) => {
            const tag = getTagById(tagDefinitions, id);
            if (!tag) return null;
            return (
              <View
                key={id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderRadius: 10,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexShrink: 1,
                  minWidth: 0,
                }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: tag.color,
                    marginRight: 5,
                  }}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1} ellipsizeMode="tail">
                    {tag.name}
                  </Text>
                </View>
              </View>
            );
          })}
          {validTags.length > 3 && (
            <Text
              style={{
                color: colors.muted,
                fontSize: 11,
                alignSelf: "center",
              }}
            >
              +{validTags.length - 3}
            </Text>
          )}
        </View>
      )}
      {showInsightRow && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            marginTop: validTags.length > 0 ? 6 : 10,
          }}
        >
          {insight?.atAllTimeLow && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: colors.success + "22",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  color: colors.success,
                  fontSize: 10,
                  fontWeight: "700",
                }}
              >
                🏅 All-time low
              </Text>
            </View>
          )}
          {insight != null && insight.dropStreak >= 2 && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: colors.primary + "22",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 10,
                  fontWeight: "700",
                }}
              >
                ▼ Dropping ×{insight.dropStreak}
              </Text>
            </View>
          )}
          {dealScore != null && dealScore.band === "hot" && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: colors.warning + "22",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  color: colors.warning,
                  fontSize: 10,
                  fontWeight: "700",
                }}
              >
                🔥 {dealBandLabel(dealScore.band)}
              </Text>
            </View>
          )}
        </View>
      )}
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
          {distributorCount} distributor{distributorCount !== 1 ? "s" : ""}{" "}
          tracked
        </Text>
        {(() => {
          const colorMap = {
            green: colors.success,
            yellow: colors.warning,
            red: colors.error,
            gray: colors.muted,
          };
          return (
            <Text style={{ color: colorMap[refreshColorKey], fontSize: 11 }}>
              Updated {formatLastRefreshed(product.lastRefreshed)}
            </Text>
          );
        })()}
        <TouchableOpacity activeOpacity={0.7}
          onPress={handleTagPress}
          hitSlop={8}
          style={{ padding: 4, marginRight: 4 }}
          accessibilityLabel="Edit tags"
          accessibilityRole="button"
        >
          <IconSymbol
            name="tag.fill"
            size={16}
            color={(product.tags?.length ?? 0) > 0 ? colors.primary : colors.muted}
          />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7}
          onPress={handleDeletePress}
          hitSlop={8}
          style={{ padding: 4 }}
          accessibilityLabel="Delete product"
          accessibilityRole="button"
          accessibilityHint="Removes this product from your watchlist"
        >
          <IconSymbol name="trash.fill" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
      </Animated.View>
    </Pressable>
  );
});
ProductCard.displayName = "ProductCard";
