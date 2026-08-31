import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Image,
  Animated,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getWatchlist, getAlerts, getSettings } from "@/lib/storage";
import { Product } from "@/lib/types";
import { formatPrice, getBestPrice } from "@/lib/currency";
import { StockBadge } from "@/components/stock-badge";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ConnectionBadge } from "@/components/connection-badge";
import { TrendingSection } from "@/components/home/trending-section";
import { useConnection } from "@/hooks/use-connection";
import { fetchProductImage } from "@/lib/server-images";



function SummaryCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  color: string;
  icon: string;
}) {
  const colors = useColors();
  return (
    <View className="flex-1 bg-surface rounded-2xl p-4 border border-border mx-1">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <IconSymbol name={icon as never} size={20} color={colors.muted} />
        <Text style={{ color, fontSize: 24, fontWeight: "700" }}>{value}</Text>
      </View>
      <Text className="text-muted text-xs mt-1">{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const connection = useConnection();
  const [watchlist, setWatchlist] = useState<Product[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [images, setImages] = useState<Map<string, string>>(new Map());
  const statAnim0 = useRef(new Animated.Value(0)).current;
  const statAnim1 = useRef(new Animated.Value(0)).current;
  const statAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(90, [
      Animated.spring(statAnim0, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 9,
      }),
      Animated.spring(statAnim1, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 9,
      }),
      Animated.spring(statAnim2, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 9,
      }),
    ]).start();
  }, [statAnim0, statAnim1, statAnim2]);

  const loadData = useCallback(async () => {
    const list = await getWatchlist();
    setWatchlist(list);
    const alerts = await getAlerts();
    setAlertCount(alerts.filter((a) => a.isActive && !a.triggeredAt).length);
    const settings = await getSettings();
    setDisplayCurrency(settings?.displayCurrency ?? "USD");
  }, []);

  // Reload whenever the tab is focused so seed/backfill changes are reflected immediately
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(async () => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const inStockCount = watchlist.reduce((count, p) => {
    const hasInStock = p.listings?.some((l) => l.stockStatus === "in_stock");
    return hasInStock ? count + 1 : count;
  }, 0);

  // Derive best stock status across all listings for a product
  function getBestStatus(product: Product): string {
    const listings = product.listings ?? [];
    if (listings.some((l) => l.stockStatus === "in_stock")) return "in_stock";
    if (listings.some((l) => l.stockStatus === "back_order"))
      return "back_order";
    if (listings.length > 0) return "out_of_stock";
    return "unknown";
  }

  const recentActivity = useMemo(() => {
    return watchlist
      .flatMap((p) => (p.listings ?? []).map((l) => ({ product: p, listing: l })))
      .sort((a, b) => {
        const aTime = isNaN(new Date(a.listing.lastChecked).getTime())
          ? 0
          : new Date(a.listing.lastChecked).getTime();
        const bTime = isNaN(new Date(b.listing.lastChecked).getTime())
          ? 0
          : new Date(b.listing.lastChecked).getTime();
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [watchlist]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const seen = new Set<string>();
      for (const { product } of recentActivity) {
        if (seen.has(product.id)) continue;
        seen.add(product.id);
        const res = await fetchProductImage(product.id);
        if (active && res) {
          setImages((prev) => new Map([...prev, [product.id, res.imageUrl]]));
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [recentActivity]);

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={true}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">
              Product Stock Finder
            </Text>
            <Text className="text-muted text-sm">
              Global availability monitor
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ConnectionBadge
              status={connection.status}
              onPress={
                connection.status === "signed-out"
                  ? () => router.push("/settings")
                  : undefined
              }
            />
            <TouchableOpacity activeOpacity={0.85}
              accessibilityLabel="Add product"
              accessibilityRole="button"
              style={{
                backgroundColor: colors.primary,
                borderRadius: 20,
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => {
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/search");
              }}
            >
              <IconSymbol name="plus" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Cards */}
        <View className="flex-row px-4 mt-3 mb-4">
          <Animated.View
            style={{
              flex: 1,
              opacity: statAnim0,
              transform: [
                {
                  translateY: statAnim0.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
                {
                  scale: statAnim0.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            }}
          >
            <SummaryCard
              label="Tracked"
              value={watchlist.length}
              color={colors.primary}
              icon="list.bullet"
            />
          </Animated.View>
          <Animated.View
            style={{
              flex: 1,
              opacity: statAnim1,
              transform: [
                {
                  translateY: statAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
                {
                  scale: statAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            }}
          >
            <SummaryCard
              label="In Stock"
              value={inStockCount}
              color={colors.success}
              icon="checkmark.circle.fill"
            />
          </Animated.View>
          <Animated.View
            style={{
              flex: 1,
              opacity: statAnim2,
              transform: [
                {
                  translateY: statAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
                {
                  scale: statAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            }}
          >
            <SummaryCard
              label="Alerts"
              value={alertCount}
              color={colors.warning}
              icon="bell.fill"
            />
          </Animated.View>
        </View>

        {/* Recent Activity */}
        <View className="px-5 mb-3">
          <Text className="text-base font-semibold text-foreground mb-3">
            Recent Activity
          </Text>
          {recentActivity.length === 0 ? (
            <View className="bg-surface rounded-2xl p-8 items-center border border-border">
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: colors.primary + "14",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.primary + "22",
                }}
              >
                <IconSymbol
                  name="magnifyingglass"
                  size={36}
                  color={colors.primary}
                />
              </View>
              <Text className="text-foreground font-semibold mt-4 text-base">
                No products tracked yet
              </Text>
              <Text className="text-muted text-sm text-center mt-1 px-2">
                Tap + to add a product to your watchlist and track prices across 25 distributors
              </Text>
              <View
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  marginTop: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <IconSymbol name="lightbulb.fill" size={16} color={colors.warning} />
                <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
                  Try: RTX 4090, Pi 5, CRS326, or U7 Pro Max
                </Text>
              </View>
              <TouchableOpacity activeOpacity={0.85}
                accessibilityLabel="Add product"
                accessibilityRole="button"
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 20,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  marginTop: 16,
                }}
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/search");
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  Add Product
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            recentActivity.map(({ product, listing }, idx) => (
              <TouchableOpacity activeOpacity={0.7}
                key={`${product.id}-${listing.distributorId}-${idx}`}
                accessibilityLabel={`${product.name}, ${formatPrice(listing.price, listing.currency)}`}
                accessibilityRole="button"
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                onPress={() => router.push(`/product/${product.id}`)}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  {images.get(product.id) && (
                    <Image
                      source={{ uri: images.get(product.id)! }}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        marginRight: 12,
                      }}
                    />
                  )}
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: "600",
                        fontSize: 14,
                      }}
                      numberOfLines={1}
                    >
                      {product.name}
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      {product.modelNumber}
                    </Text>
                  </View>
                  <StockBadge
                    status={listing.stockStatus}
                    expectedDate={listing.expectedDate}
                  />
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 8,
                  }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: "700",
                      fontSize: 15,
                    }}
                  >
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

        {/* Trending */}
        <TrendingSection />

        {/* Quick Access */}
        {watchlist.length > 0 && (
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
                <TouchableOpacity activeOpacity={0.7}
                  key={product.id}
                  accessibilityLabel={`${product.name}, ${bestPrice ? formatPrice(bestPrice.price, bestPrice.currency) : "no price"}`}
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
                  onPress={() => router.push(`/product/${product.id}`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: "600",
                        fontSize: 14,
                      }}
                      numberOfLines={1}
                    >
                      {product.name}
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 12,
                        marginTop: 2,
                      }}
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
              <TouchableOpacity activeOpacity={0.7}
                onPress={() => router.push("/watchlist")}
                accessibilityLabel={`View all ${watchlist.length} products`}
                accessibilityRole="button"
                style={{ alignItems: "center", paddingVertical: 8 }}
              >
                <Text style={{ color: colors.primary, fontWeight: "600" }}>
                  View all {watchlist.length} products →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
