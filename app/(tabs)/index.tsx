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
  Easing,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getWatchlist, getAlerts, getSettings } from "@/lib/storage";
import { Product, StockStatus } from "@/lib/types";
import { formatPrice } from "@shared/currency";
import { getBestPrice } from "@/lib/currency";
import { formatLastRefreshed } from "@/lib/last-refreshed";
import { StockBadge } from "@/components/stock-badge";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ConnectionBadge } from "@/components/connection-badge";
import { TrendingSection } from "@/components/home/trending-section";
import { useConnection } from "@/hooks/use-connection";
import { fetchProductImage } from "@/lib/server-images";



const STOCK_ORDER: Record<StockStatus, number> = {
  in_stock: 0,
  back_order: 1,
  out_of_stock: 2,
  unknown: 3,
};

// Derive best stock status across all listings for a product
function getBestStatus(product: Product): StockStatus {
  const listings = product.listings ?? [];
  if (!listings.length) return "unknown";
  const sorted = [...listings].sort(
    (a, b) => STOCK_ORDER[a.stockStatus] - STOCK_ORDER[b.stockStatus],
  );
  return sorted[0]!.stockStatus;
}

function useAnimatedNumber(target: number) {
  const [display, setDisplay] = useState(target);
  const anim = useRef(new Animated.Value(target)).current;
  const prev = useRef(target);
  useEffect(() => {
    const id = anim.addListener(({ value }) => setDisplay(Math.round(value)));
    return () => anim.removeListener(id);
  }, [anim]);
  useEffect(() => {
    if (prev.current === target) return;
    prev.current = target;
    Animated.timing(anim, { toValue: target, duration: 520, useNativeDriver: false, easing: Easing.out(Easing.cubic) } as unknown as Animated.TimingAnimationConfig).start();
  }, [target, anim]);
  useEffect(() => { anim.setValue(target); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return display;
}

// Shared stat pill — tokens aligned with components/watchlist/summary-card.tsx: 16px radius, 16px padding, 1px border
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
  const numericValue = typeof value === "number" ? value : 0;
  const animatedNumber = useAnimatedNumber(numericValue);
  const numeric = typeof value === "number" ? animatedNumber : value;
  const pop = useRef(new Animated.Value(1)).current;
  const prevVal = useRef(value);
  useEffect(() => {
    if (prevVal.current !== value) {
      prevVal.current = value;
      Animated.sequence([
        Animated.spring(pop, { toValue: 1.12, useNativeDriver: true, tension: 280, friction: 8 }),
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, tension: 180, friction: 9 }),
      ]).start();
    }
  }, [value, pop]);
  return (
    <View
      className="flex-1 bg-surface rounded-2xl p-4 border border-border"
      style={{ borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <IconSymbol name={icon as never} size={20} color={colors.muted} />
        <Animated.Text style={{ color, fontSize: 24, fontWeight: "700", transform: [{ scale: pop }] }}>{numeric}</Animated.Text>
      </View>
      <Text className="text-muted text-xs mt-1">{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const connection = useConnection();
  const queryClient = useQueryClient();
  const [watchlist, setWatchlist] = useState<Product[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    try {
      setLoadError(null);
      const list = await getWatchlist();
      setWatchlist(list);
      const alerts = await getAlerts();
      setAlertCount(alerts.filter((a) => a.isActive && !a.triggeredAt).length);
      const settings = await getSettings();
      setDisplayCurrency(settings?.displayCurrency ?? "USD");
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : "Failed to load watchlist");
    } finally {
      setLoaded(true);
    }
  }, []);

  // Invalidate cached watchlist preview when watchlist mutates so home never shows stale data
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    void queryClient.invalidateQueries({ queryKey: ["watchlist_preview"] });
  }, [watchlist, queryClient]);

  // Reload whenever the tab is focused so seed/backfill changes are reflected immediately
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(async () => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    try {
      await Promise.all([
        loadData(),
        queryClient.invalidateQueries({ queryKey: ["trending"] }),
      ]);
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRefreshing(false);
    }
  }, [loadData, queryClient]);

  const inStockCount = useMemo(
    () =>
      watchlist.reduce((count, p) => {
        const hasInStock = p.listings?.some((l) => l.stockStatus === "in_stock");
        return hasInStock ? count + 1 : count;
      }, 0),
    [watchlist],
  );

  const recentActivity = useMemo(() => {
    const withTime = watchlist.map((p) => {
      const listings = p.listings ?? [];
      if (listings.length === 0) {
        const raw = p.addedAt as string | undefined;
        const t = raw ? Date.parse(raw) : NaN;
        const fallback = isNaN(t) ? 0 : t;
        return { product: p, listing: null as unknown as typeof listings[0] | null, sortTime: fallback };
      }
      let best = listings[0]!;
      let bestTime = isNaN(new Date(best.lastChecked).getTime()) ? 0 : new Date(best.lastChecked).getTime();
      for (const l of listings) {
        const t = isNaN(new Date(l.lastChecked).getTime()) ? 0 : new Date(l.lastChecked).getTime();
        if (t > bestTime) {
          best = l;
          bestTime = t;
        }
      }
      return { product: p, listing: best as typeof listings[0] | null, sortTime: bestTime };
    });
    withTime.sort((a, b) => b.sortTime - a.sortTime);
    return withTime.slice(0, 5).map(({ product, listing }) => ({ product, listing }));
  }, [watchlist]);

  const recentIdsKey = useMemo(() => recentActivity.map(({ product }) => product.id).join(","), [recentActivity]);

  useEffect(() => {
    let active = true;
    const ids = recentIdsKey ? recentIdsKey.split(",").filter(Boolean) : [];
    if (ids.length === 0) {
      setImages(new Map());
      return;
    }
    const load = async () => {
      const results = await Promise.allSettled(ids.map((id) => fetchProductImage(id)));
      if (!active) return;
      const newImages = new Map<string, string>();
      results.forEach((r, i) => {
        const pid = ids[i];
        if (r.status === "fulfilled" && r.value && pid) {
          newImages.set(pid, r.value.imageUrl);
        }
      });
      setImages(newImages);
    };
    load();
    return () => {
      active = false;
    };
  }, [recentIdsKey]);

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
        <View className="flex-row px-4 mt-3 mb-4" style={{ gap: 8 }}>
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
          {!loaded ? (
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Loading watchlist…</Text>
            </View>
          ) : loadError ? (
            <View className="bg-surface rounded-2xl p-6 items-center border border-border">
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.error + "14",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.error + "22",
                }}
              >
                <IconSymbol name="exclamationmark.triangle.fill" size={24} color={colors.error} />
              </View>
              <Text style={{ color: colors.foreground, fontWeight: "600", marginTop: 12, textAlign: "center" }}>
                Couldn&apos;t load watchlist
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, textAlign: "center" }}>
                {loadError}
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                accessibilityLabel="Retry loading watchlist"
                accessibilityRole="button"
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 20,
                  paddingHorizontal: 24,
                  paddingVertical: 10,
                  marginTop: 14,
                }}
                onPress={() => {
                  setLoaded(false);
                  void loadData();
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : recentActivity.length === 0 ? (
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
                  borderColor: colors.primary + "22",
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
            recentActivity.map(({ product, listing }) => {
              const bestPrice = getBestPrice(product.listings ?? [], displayCurrency);
              return (
              <TouchableOpacity activeOpacity={0.7}
                key={product.id}
                accessibilityLabel={bestPrice ? `${product.name}, ${formatPrice(bestPrice.price, bestPrice.currency)}` : product.name}
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
                  {images.get(product.id) ? (
                    <Image
                      source={{ uri: images.get(product.id)! }}
                      onError={() => setImages((prev) => { const n = new Map(prev); n.delete(product.id); return n; })}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        marginRight: 12,
                        backgroundColor: colors.border,
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        marginRight: 12,
                        backgroundColor: colors.border + "66",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <IconSymbol name="photo" size={14} color={colors.muted} />
                    </View>
                  )}
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
                      {product.modelNumber}
                    </Text>
                  </View>
                  <StockBadge
                    status={listing ? listing!.stockStatus : "unknown"}
                    expectedDate={listing?.expectedDate}
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
                    {bestPrice ? formatPrice(bestPrice.price, bestPrice.currency) : "—"}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {listing ? formatLastRefreshed(listing!.lastChecked) : formatLastRefreshed(product.addedAt)}
                  </Text>
                </View>
              </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Trending */}
        <View style={{ paddingHorizontal: 16 }}>
          <TrendingSection />
        </View>

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
