import { Text, TouchableOpacity, View } from "react-native";
import { formatPrice } from "@shared/currency";
import { useColors } from "@/hooks/use-colors";
import { StockBadge } from "@/components/stock-badge";
import { getBestPrice } from "@/lib/currency";
import type { Product, StockStatus } from "@/lib/types";

const STOCK_ORDER: Record<StockStatus, number> = {
  in_stock: 0,
  back_order: 1,
  out_of_stock: 2,
  unknown: 3,
};

function getBestStatus(product: Product): StockStatus {
  const listings = product.listings ?? [];
  if (!listings.length) return "unknown";
  const sorted = [...listings].sort(
    (a, b) => STOCK_ORDER[a.stockStatus] - STOCK_ORDER[b.stockStatus],
  );
  return sorted[0]!.stockStatus;
}

export function HomeWatchlistPreview({
  watchlist,
  displayCurrency,
  onViewProduct,
  onViewAll,
}: {
  watchlist: Product[];
  displayCurrency: string;
  onViewProduct: (productId: string) => void;
  onViewAll: () => void;
}) {
  const colors = useColors();
  return (
    <View className="px-5">
      <Text className="text-base font-semibold text-foreground mb-3">
        Your Watchlist
      </Text>
      {watchlist.slice(0, 3).map((product) => {
        const bestPrice = getBestPrice(
          product.listings ?? [],
          displayCurrency,
        );
        const bestStatus = getBestStatus(product);
        return (
          <TouchableOpacity
            activeOpacity={0.7}
            key={product.id}
            accessibilityLabel={`${product.name}, ${
              bestPrice
                ? formatPrice(bestPrice.price, bestPrice.currency)
                : "no price"
            }`}
            accessibilityRole="button"
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 14,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
            }}
            onPress={() => onViewProduct(product.id)}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "600",
                  fontSize: 14,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {product.name}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  marginTop: 2,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {product.brand} · {product.category}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {bestPrice && (
                <Text
                  style={{
                    color: colors.primary,
                    fontWeight: "700",
                    fontSize: 15,
                  }}
                >
                  {formatPrice(bestPrice.price, bestPrice.currency)}
                </Text>
              )}
              <View style={{ marginTop: 4 }}>
                <StockBadge status={bestStatus} />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
      {watchlist.length > 3 && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onViewAll}
          accessibilityLabel={`View all ${watchlist.length} product${
            watchlist.length === 1 ? "" : "s"
          }`}
          accessibilityRole="button"
          style={{ alignItems: "center", paddingVertical: 8 }}
        >
          <Text style={{ color: colors.primary, fontWeight: "600" }}>
            View all {watchlist.length} product
            {watchlist.length === 1 ? "" : "s"} →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
