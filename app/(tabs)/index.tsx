import { useEffect, useState, useCallback } from "react";
import { ScrollView, Text, View, TouchableOpacity, RefreshControl, FlatList } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getWatchlist } from "@/lib/storage";
import { Product } from "@/lib/types";
import { formatPrice, convertPrice, getBestPrice } from "@/lib/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";

function StockBadge({ status, expectedDate }: { status: string; expectedDate?: string }) {
  const colors = useColors();
  if (status === "in_stock") {
    return (
      <View style={{ backgroundColor: colors.success + "22", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ color: colors.success, fontSize: 11, fontWeight: "600" }}>● In Stock</Text>
      </View>
    );
  }
  if (status === "back_order") {
    return (
      <View style={{ backgroundColor: colors.warning + "22", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ color: colors.warning, fontSize: 11, fontWeight: "600" }}>
          ● Back Order{expectedDate ? ` · ${expectedDate}` : ""}
        </Text>
      </View>
    );
  }
  if (status === "out_of_stock") {
    return (
      <View style={{ backgroundColor: colors.error + "22", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ color: colors.error, fontSize: 11, fontWeight: "600" }}>● Out of Stock</Text>
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: colors.muted + "22", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>● Unknown</Text>
    </View>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: string }) {
  return (
    <View className="flex-1 bg-surface rounded-2xl p-4 border border-border mx-1">
      <Text style={{ color, fontSize: 24, fontWeight: "700" }}>{value}</Text>
      <Text className="text-muted text-xs mt-1">{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const [watchlist, setWatchlist] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const list = await getWatchlist();
    setWatchlist(list);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const inStockCount = watchlist.reduce((count, p) => {
    const hasInStock = p.listings?.some((l) => l.stockStatus === "in_stock");
    return hasInStock ? count + 1 : count;
  }, 0);

  const recentActivity = watchlist
    .flatMap((p) =>
      (p.listings ?? []).map((l) => ({ product: p, listing: l }))
    )
    .sort((a, b) => new Date(b.listing.lastChecked).getTime() - new Date(a.listing.lastChecked).getTime())
    .slice(0, 5);

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">Stock Tracker</Text>
            <Text className="text-muted text-sm">Global availability monitor</Text>
          </View>
          <TouchableOpacity
            style={{ backgroundColor: colors.primary, borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/search" as any);
            }}
          >
            <IconSymbol name="plus" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Summary Cards */}
        <View className="flex-row px-4 mt-3 mb-4">
          <SummaryCard label="Tracked" value={watchlist.length} color={colors.primary} icon="list.bullet" />
          <SummaryCard label="In Stock" value={inStockCount} color={colors.success} icon="checkmark.circle.fill" />
          <SummaryCard label="Alerts" value={0} color={colors.warning} icon="bell.fill" />
        </View>

        {/* Recent Activity */}
        <View className="px-5 mb-3">
          <Text className="text-base font-semibold text-foreground mb-3">Recent Activity</Text>
          {recentActivity.length === 0 ? (
            <View className="bg-surface rounded-2xl p-8 items-center border border-border">
              <IconSymbol name="magnifyingglass" size={40} color={colors.muted} />
              <Text className="text-foreground font-semibold mt-3 text-base">No products tracked yet</Text>
              <Text className="text-muted text-sm text-center mt-1">Tap + to add a product to your watchlist</Text>
              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, marginTop: 16 }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/search" as any);
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Add Product</Text>
              </TouchableOpacity>
            </View>
          ) : (
            recentActivity.map(({ product, listing }, idx) => (
              <TouchableOpacity
                key={`${product.id}-${listing.distributorId}-${idx}`}
                style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}
                onPress={() => router.push(`/product/${product.id}` as any)}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>{product.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{product.modelNumber}</Text>
                  </View>
                  <StockBadge status={listing.stockStatus} expectedDate={listing.expectedDate} />
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>
                    {formatPrice(listing.price, listing.currency)}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {new Date(listing.lastChecked).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Access */}
        {watchlist.length > 0 && (
          <View className="px-5">
            <Text className="text-base font-semibold text-foreground mb-3">Your Watchlist</Text>
            {watchlist.slice(0, 3).map((product) => {
              const bestPrice = getBestPrice(product.listings ?? [], "USD");
              const inStock = product.listings?.some((l) => l.stockStatus === "in_stock");
              return (
                <TouchableOpacity
                  key={product.id}
                  style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center" }}
                  onPress={() => router.push(`/product/${product.id}` as any)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>{product.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{product.brand} · {product.category}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    {bestPrice && (
                      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>
                        {formatPrice(bestPrice.price, bestPrice.currency)}
                      </Text>
                    )}
                    <View style={{ marginTop: 4 }}>
                      <StockBadge status={inStock ? "in_stock" : "out_of_stock"} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            {watchlist.length > 3 && (
              <TouchableOpacity onPress={() => router.push("/watchlist" as any)} style={{ alignItems: "center", paddingVertical: 8 }}>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>View all {watchlist.length} products →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
