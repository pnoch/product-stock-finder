import {
  Text,
  TouchableOpacity,
  View,
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
      }}
    >
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
            backgroundColor: colors.primary + "22",
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
          >
            {product.brand}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {product.category}
          </Text>
          {onEditDetails && (
            <TouchableOpacity
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
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
        {product.description}
      </Text>
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
          <Text style={{ color: colors.muted, fontSize: 11 }}>
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
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            In Stock
          </Text>
          <Text
            style={{
              color: colors.success,
              fontWeight: "700",
              fontSize: 20,
            }}
          >
            {listings.filter((l) => l.stockStatus === "in_stock").length}
          </Text>
        </View>
        <View>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            Best Price
          </Text>
          <Text
            style={{
              color: colors.primary,
              fontWeight: "700",
              fontSize: 20,
            }}
          >
            {(() => {
              const best = getBestPrice(visibleListings, "USD");
              return best ? formatPrice(best.price, "USD") : "N/A";
            })()}
          </Text>
        </View>
      </View>
      {/* Last Refreshed Indicator */}
      {(() => {
        const refreshTime = lastUpdatedAt
          ? new Date(lastUpdatedAt).toISOString()
          : product.lastRefreshed;
        const refreshColor = getLastRefreshedColor(refreshTime);
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
              color={colorMap[refreshColor]}
            />
            <Text
              style={{
                color: colorMap[refreshColor],
                fontSize: 12,
                fontWeight: "500",
              }}
            >
              Last refreshed: {formatLastRefreshed(refreshTime)}
            </Text>
          </View>
        );
      })()}
      {/* Currency Converter Widget — shows best in-stock price in user's preferred currency */}
      {(() => {
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
        return (
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
                backgroundColor: colors.primary + "22",
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
                {formatPrice(convertedPrice, displayCurrency)}
              </Text>
              {bestListing.currency !== displayCurrency &&
                (() => {
                  const rate = convertPrice(1, bestListing.currency, displayCurrency);
                  return rate !== null ? (
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                      1 {bestListing.currency} = {rate.toFixed(4)} {displayCurrency}
                    </Text>
                  ) : null;
                })()}
            </View>
          </View>
        );
      })()}
    </View>
  );
}
