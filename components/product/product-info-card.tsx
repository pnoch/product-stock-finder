import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import {
  Text,
  TouchableOpacity,
  View,
  Animated,
  Image,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import {
  formatPrice,
  convertPrice,
  getBestPrice,
} from "@/lib/currency";
import {
  formatLastRefreshed,
  getLastRefreshedColor,
} from "@/lib/last-refreshed";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { Product } from "@/lib/types";

// ─── ProductInfoCard ─────────────────────────────────────────────────────────

interface ProductInfoCardProps {
  product: Product;
  listings: DistributorListing[];
  visibleListings: DistributorListing[];
  lastUpdatedAt?: string;
  displayCurrency: string;
  productImage: string | null;
  onEditDetails?: () => void;
}

export function ProductInfoCard({
  product,
  listings,
  visibleListings,
  lastUpdatedAt,
  displayCurrency,
  productImage,
  onEditDetails,
}: ProductInfoCardProps) {
  const colors = useColors();
  const [imageError, setImageError] = useState(false);
  const imageOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setImageError(false);
    if (productImage) {
      Animated.timing(imageOpacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }).start();
    } else {
      imageOpacity.setValue(0);
    }
  }, [productImage, imageOpacity]);
  const handleImageError = useCallback(() => setImageError(true), []);

  const primary22 = useMemo(() => colors.primary + "22", [colors.primary]);

  const inStockCount = useMemo(
    () => listings.filter((l) => l.stockStatus === "in_stock").length,
    [listings],
  );

  const bestPriceDisplay = useMemo(() => {
    const best = getBestPrice(visibleListings, displayCurrency);
    return best ? formatPrice(best.price, displayCurrency) : "N/A";
  }, [visibleListings, displayCurrency]);

  const lastRefreshedData = useMemo(() => {
    const d = lastUpdatedAt ? new Date(lastUpdatedAt) : null;
    const refreshTime =
      lastUpdatedAt && d && !isNaN(d.getTime())
        ? d.toISOString()
        : product.lastRefreshed;
    const refreshColor = getLastRefreshedColor(refreshTime);
    const colorMap = {
      green: colors.success,
      yellow: colors.warning,
      red: colors.error,
      gray: colors.muted,
    };
    return { refreshTime, refreshColor, colorMap };
  }, [
    lastUpdatedAt,
    product.lastRefreshed,
    colors.success,
    colors.warning,
    colors.error,
    colors.muted,
  ]);

  const currencyConverterData = useMemo(() => {
    if (displayCurrency === "USD") return null;
    const available = visibleListings.filter(
      (l) => l.stockStatus !== "out_of_stock" && l.price > 0,
    );
    if (!available.length) return null;
    const bestListing = available.reduce((best, curr) => {
      const cPrice = convertPrice(curr.price, curr.currency, displayCurrency);
      const bPrice = convertPrice(best.price, best.currency, displayCurrency);
      if (cPrice === null) return best;
      if (bPrice === null) return curr;
      return cPrice < bPrice ? curr : best;
    });
    const convertedPrice = convertPrice(
      bestListing.price,
      bestListing.currency,
      displayCurrency,
    );
    if (convertedPrice === null) return null;
    return { bestListing, convertedPrice };
  }, [displayCurrency, visibleListings]);

  return (
    <View
      style={{
        marginHorizontal: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      {productImage && !imageError ? (
        <Animated.View
          style={{
            opacity: imageOpacity,
            marginHorizontal: -16,
            marginTop: -16,
            marginBottom: 14,
          }}
        >
          <Image
            source={{ uri: productImage }}
            onError={handleImageError}
            style={{
              width: "100%",
              height: 190,
              backgroundColor: colors.border,
            }}
            resizeMode="cover"
          />
        </Animated.View>
      ) : (
        <View
          style={{
            marginHorizontal: -16,
            marginTop: -16,
            marginBottom: 14,
            height: 120,
            backgroundColor: colors.border + "66",
            alignItems: "center",
            justifyContent: "center",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <IconSymbol name="photo" size={28} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }} numberOfLines={1} ellipsizeMode="tail">
            No image
          </Text>
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <View
          style={{
            backgroundColor: primary22,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 5,
          }}
        >
          <Text
            style={{
              color: colors.primary,
              fontWeight: "600",
              fontSize: 13,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {product.brand}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, marginLeft: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 13, flexShrink: 1 }} numberOfLines={1} ellipsizeMode="tail">
            {product.category}
          </Text>
          {onEditDetails && (
            <TouchableOpacity activeOpacity={0.7}
              onPress={onEditDetails}
              hitSlop={8}
              style={{ padding: 2 }}
              accessibilityLabel="Edit product details"
              accessibilityRole="button"
            >
              <IconSymbol name="pencil" size={14} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }} numberOfLines={4} ellipsizeMode="tail">
        {product.description || "No description available."}
      </Text>
      <View style={{ marginTop: 12, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
        {[
          { label: "Brand", value: product.brand },
          { label: "Model", value: product.modelNumber },
          { label: "Category", value: product.category },
          ...(product.imageUrl ? [{ label: "Image", value: "Available" }] : []),
        ].map((row, idx) => (
          <View
            key={row.label}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 9,
              backgroundColor: idx % 2 === 0 ? colors.background : colors.surface,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{row.label}</Text>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", flexShrink: 1, marginLeft: 8 }} numberOfLines={1} ellipsizeMode="tail">{row.value}</Text>
          </View>
        ))}
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 14,
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Distributors
          </Text>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "700",
              fontSize: 20,
            }}
          >
            {listings.length}
          </Text>
        </View>
        <View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            In Stock
          </Text>
          <Text
            style={{
              color: colors.success,
              fontWeight: "700",
              fontSize: 20,
            }}
          >
            {inStockCount}
          </Text>
        </View>
        <View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Best Price
          </Text>
          <Text
            style={{
              color: colors.primary,
              fontWeight: "700",
              fontSize: 20,
            }}
          >
            {bestPriceDisplay}
          </Text>
        </View>
      </View>
      {/* Last Refreshed Indicator */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <IconSymbol
          name="arrow.clockwise"
          size={14}
          color={lastRefreshedData.colorMap[lastRefreshedData.refreshColor]}
        />
        <Text
          style={{
            color: lastRefreshedData.colorMap[lastRefreshedData.refreshColor],
            fontSize: 12,
            fontWeight: "500",
          }}
        >
          Last refreshed: {formatLastRefreshed(lastRefreshedData.refreshTime)}
        </Text>
      </View>
      {/* Currency Converter Widget — shows best in-stock price in user's preferred currency */}
      {currencyConverterData && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: 10,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <IconSymbol
            name="arrow.left.arrow.right"
            size={14}
            color={colors.muted}
          />
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Best in-stock price in
          </Text>
          <View
            style={{
              backgroundColor: primary22,
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {displayCurrency}
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              {formatPrice(currencyConverterData.convertedPrice, displayCurrency)}
            </Text>
            {currencyConverterData.bestListing.currency !== displayCurrency &&
              (() => {
                const rate = convertPrice(
                  1,
                  currencyConverterData.bestListing.currency,
                  displayCurrency,
                );
                return rate !== null ? (
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                    1 {currencyConverterData.bestListing.currency} = {rate.toFixed(4)}{" "}
                    {displayCurrency}
                  </Text>
                ) : null;
              })()}
          </View>
        </View>
      )}
    </View>
  );
}
