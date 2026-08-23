import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";

import { ScreenContainer } from "@/components/screen-container";
import { CompareHeader } from "@/components/compare/compare-header";
import { ChartCard } from "@/components/compare/chart-card";
import { CheapestRegionCard } from "@/components/compare/cheapest-region-card";
import { useColors } from "@/hooks/use-colors";
import { useLiveProduct } from "@/hooks/use-live-prices";
import { addAlert } from "@/lib/storage";
import {
  schedulePriceAlert,
  requestNotificationPermissions,
} from "@/lib/notifications";
import { PriceAlert } from "@/lib/types";
import { formatPrice, convertPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PRODUCT_CATALOG } from "@/lib/catalog";
import {
  CHART_COLORS,
  TimeRange,
  SortBy,
  filterByRange,
} from "@/lib/compare-utils";

// ─── Compare Screen ───────────────────────────────────────────────────────────
export default function CompareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [timeRange, setTimeRange] = useState<TimeRange>("3M");
  const [sortBy, setSortBy] = useState<SortBy>("trend");
  const { product, listings, loaded, isRefreshingAny, refresh } =
    useLiveProduct(id);
  const productName =
    product?.name ??
    PRODUCT_CATALOG.find((p) => p.id === id)?.name ??
    (id as string);
  const notFound = loaded && !product && listings.length === 0;
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = windowWidth - 32;

  const selectionInitialized = useRef(false);
  useEffect(() => {
    if (!loaded || selectionInitialized.current) return;
    selectionInitialized.current = true;
    const withHistory = listings.filter(
      (l) => l.priceHistory && l.priceHistory.length >= 2,
    );
    setSelected(new Set(withHistory.slice(0, 3).map((l) => l.distributorId)));
  }, [loaded, listings]);

  const toggleSelect = useCallback((distributorId: string) => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(distributorId)) {
        next.delete(distributorId);
      } else if (next.size < 5) {
        next.add(distributorId);
      }
      return next;
    });
  }, []);

  const setRange = useCallback((r: TimeRange) => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeRange(r);
  }, []);

  const setSortByMode = useCallback((s: SortBy) => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortBy(s);
  }, []);

  const handleCrossAlert = useCallback(async () => {
    const inStock = listings.filter((l) => l.stockStatus === "in_stock");
    if (inStock.length === 0) {
      showAlert(
        "No in-stock distributors",
        "There are no in-stock distributors to set an alert for.",
      );
      return;
    }
    const bestUSD = Math.min(
      ...inStock.map((l) => convertPrice(l.price, l.currency, "USD")),
    );
    const targetUSD = parseFloat((bestUSD * 0.95).toFixed(2));
    const bestListing = inStock.find(
      (l) => convertPrice(l.price, l.currency, "USD") === bestUSD,
    )!;
    const dist = getDistributorById(bestListing.distributorId);
    const granted = await requestNotificationPermissions();
    if (!granted) {
      showAlert(
        "Permission Denied",
        "Please enable notifications in your device settings to receive price alerts.",
      );
      return;
    }
    const alert: PriceAlert = {
      id: `cross-${id}-${Date.now()}`,
      productId: id as string,
      distributorId: bestListing.distributorId,
      targetPrice: targetUSD,
      currency: "USD",
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    await addAlert(alert);
    await schedulePriceAlert(productName || "Product", targetUSD, "USD");
    showAlert(
      "Alert Set!",
      `You'll be notified when any distributor drops below $${targetUSD.toFixed(2)} (5% below current best of $${bestUSD.toFixed(2)} at ${dist?.name ?? bestListing.distributorId}).`,
    );
  }, [listings, id, productName]);

  const priceTrends = useMemo(() => {
    const map = new Map<string, { pct: number; dir: "up" | "down" | "flat" }>();
    for (const l of listings) {
      if (!l.priceHistory || l.priceHistory.length < 2) {
        map.set(l.distributorId, { pct: 0, dir: "flat" });
        continue;
      }
      const sorted = [...l.priceHistory].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      const oldest = sorted[0].price;
      const current = l.price;
      const pct = oldest > 0 ? ((current - oldest) / oldest) * 100 : 0;
      map.set(l.distributorId, {
        pct: Math.abs(pct),
        dir: pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat",
      });
    }
    return map;
  }, [listings]);

  const sortedListings = useMemo(() => {
    const ls = [...listings];
    if (sortBy === "price")
      return ls.sort(
        (a, b) =>
          convertPrice(a.price, a.currency, "USD") -
          convertPrice(b.price, b.currency, "USD"),
      );
    if (sortBy === "name")
      return ls.sort((a, b) =>
        (
          getDistributorById(a.distributorId)?.name ?? a.distributorId
        ).localeCompare(
          getDistributorById(b.distributorId)?.name ?? b.distributorId,
        ),
      );
    // trend: biggest drop first
    return ls.sort((a, b) => {
      const ta = priceTrends.get(a.distributorId);
      const tb = priceTrends.get(b.distributorId);
      const scoreA =
        ta?.dir === "down" ? ta.pct : ta?.dir === "up" ? -ta.pct : 0;
      const scoreB =
        tb?.dir === "down" ? tb.pct : tb?.dir === "up" ? -tb.pct : 0;
      return scoreB - scoreA;
    });
  }, [listings, sortBy, priceTrends]);

  const chartSeries = useMemo(() => {
    const selectedListings = listings.filter(
      (l) =>
        selected.has(l.distributorId) &&
        l.priceHistory &&
        l.priceHistory.length >= 2,
    );
    return selectedListings.map((l) => {
      const distributor = getDistributorById(l.distributorId);
      const filtered = filterByRange(l.priceHistory!, timeRange);
      const colorIdx = Array.from(selected).indexOf(l.distributorId);
      return {
        label: distributor?.name ?? l.distributorId,
        color: CHART_COLORS[colorIdx % CHART_COLORS.length],
        data: filtered.length >= 2 ? filtered : l.priceHistory!,
        currency: l.currency,
      };
    });
  }, [listings, selected, timeRange]);

  return (
    <ScreenContainer>
      {!loaded ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : notFound ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <IconSymbol name="magnifyingglass" size={40} color={colors.muted} />
          <Text
            style={{
              color: colors.foreground,
              fontSize: 16,
              fontWeight: "600",
              marginTop: 12,
            }}
          >
            Product not found
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: 16 }}
          >
            <Text style={{ color: colors.primary, fontWeight: "600" }}>
              Go back
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Header */}
          <CompareHeader
            productName={productName}
            isRefreshing={isRefreshingAny}
            onRefresh={refresh}
            onBack={() => router.back()}
          />

          <ChartCard
            timeRange={timeRange}
            onRangeChange={setRange}
            chartSeries={chartSeries}
            chartWidth={chartWidth}
          />

          {/* Cheapest Region summary */}
          <CheapestRegionCard listings={listings} />

          {/* Cross-distributor alert CTA */}
          {listings.some((l) => l.stockStatus === "in_stock") &&
            (() => {
              const inStock = listings.filter(
                (l) => l.stockStatus === "in_stock",
              );
              const bestUSD = Math.min(
                ...inStock.map((l) => convertPrice(l.price, l.currency, "USD")),
              );
              return (
                <TouchableOpacity
                  onPress={handleCrossAlert}
                  style={{
                    marginHorizontal: 16,
                    marginBottom: 16,
                    backgroundColor: colors.primary + "18",
                    borderRadius: 14,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: colors.primary + "44",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <IconSymbol
                    name="bell.fill"
                    size={18}
                    color={colors.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.primary,
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                    >
                      Alert me if any distributor drops below
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 12,
                        marginTop: 1,
                      }}
                    >
                      ${(bestUSD * 0.95).toFixed(2)} (5% below current best of $
                      {bestUSD.toFixed(2)})
                    </Text>
                  </View>
                  <IconSymbol
                    name="chevron.right"
                    size={16}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              );
            })()}

          {/* Current prices comparison table */}
          {selected.size > 0 && (
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
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "700",
                  fontSize: 15,
                  marginBottom: 12,
                }}
              >
                Current Prices
              </Text>
              {listings
                .filter((l) => selected.has(l.distributorId))
                .map((l, i) => {
                  const distributor = getDistributorById(l.distributorId);
                  const usd = convertPrice(l.price, l.currency, "USD");
                  const color =
                    CHART_COLORS[
                      Array.from(selected).indexOf(l.distributorId) %
                        CHART_COLORS.length
                    ];
                  return (
                    <View
                      key={l.distributorId}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 10,
                        borderTopWidth: i > 0 ? 1 : 0,
                        borderTopColor: colors.border,
                      }}
                    >
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: color,
                          marginRight: 10,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: colors.foreground,
                            fontWeight: "600",
                            fontSize: 14,
                          }}
                        >
                          {distributor?.countryFlag}{" "}
                          {distributor?.name ?? l.distributorId}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {distributor?.country}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            color: colors.foreground,
                            fontWeight: "700",
                            fontSize: 15,
                          }}
                        >
                          {formatPrice(l.price, l.currency)}
                        </Text>
                        {l.currency !== "USD" && (
                          <Text style={{ color: colors.muted, fontSize: 11 }}>
                            ≈ ${usd.toFixed(2)}
                          </Text>
                        )}
                        <View
                          style={{
                            backgroundColor:
                              l.stockStatus === "in_stock"
                                ? colors.success + "22"
                                : colors.warning + "22",
                            borderRadius: 8,
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                            marginTop: 2,
                          }}
                        >
                          <Text
                            style={{
                              color:
                                l.stockStatus === "in_stock"
                                  ? colors.success
                                  : colors.warning,
                              fontSize: 10,
                              fontWeight: "600",
                            }}
                          >
                            {l.stockStatus === "in_stock"
                              ? "In Stock"
                              : l.stockStatus === "back_order"
                                ? "Back Order"
                                : l.stockStatus === "unknown"
                                  ? "Unknown"
                                  : "Out of Stock"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
            </View>
          )}

          {/* Distributor selector */}
          <View style={{ paddingHorizontal: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "700",
                  fontSize: 15,
                }}
              >
                Select Distributors ({selected.size}/5)
              </Text>
              <View style={{ flexDirection: "row", gap: 4 }}>
                {(["trend", "price", "name"] as SortBy[]).map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSortByMode(s)}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor:
                        sortBy === s ? colors.primary : colors.border + "44",
                    }}
                  >
                    <Text
                      style={{
                        color: sortBy === s ? "#fff" : colors.muted,
                        fontSize: 11,
                        fontWeight: "600",
                      }}
                    >
                      {s === "trend"
                        ? "Trend ▼"
                        : s === "price"
                          ? "Price"
                          : "A–Z"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {sortedListings.map((l) => {
              const distributor = getDistributorById(l.distributorId);
              const isSelected = selected.has(l.distributorId);
              const hasHistory = l.priceHistory && l.priceHistory.length >= 2;
              const colorIdx = Array.from(selected).indexOf(l.distributorId);
              const chipColor = isSelected
                ? CHART_COLORS[colorIdx % CHART_COLORS.length]
                : colors.border;
              const trend = priceTrends.get(l.distributorId);
              return (
                <TouchableOpacity
                  key={l.distributorId}
                  onPress={() => toggleSelect(l.distributorId)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: isSelected
                      ? chipColor + "18"
                      : colors.surface,
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 8,
                    borderWidth: 1.5,
                    borderColor: isSelected ? chipColor : colors.border,
                    opacity: !hasHistory && !isSelected ? 0.5 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: isSelected ? chipColor : colors.border,
                      backgroundColor: isSelected ? chipColor : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    {isSelected && (
                      <IconSymbol name="checkmark" size={12} color="#fff" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: "600",
                        fontSize: 14,
                      }}
                    >
                      {distributor?.countryFlag}{" "}
                      {distributor?.name ?? l.distributorId}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {hasHistory
                        ? `${l.priceHistory!.length} price points`
                        : "No price history"}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        color: isSelected ? chipColor : colors.foreground,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      {formatPrice(l.price, l.currency)}
                    </Text>
                    {trend && trend.dir !== "flat" && (
                      <Text
                        style={{
                          color:
                            trend.dir === "down"
                              ? colors.success
                              : colors.error,
                          fontSize: 11,
                          fontWeight: "600",
                          marginTop: 1,
                        }}
                      >
                        {trend.dir === "down" ? "▼" : "▲"}{" "}
                        {trend.pct.toFixed(1)}%
                      </Text>
                    )}
                    <View
                      style={{
                        backgroundColor:
                          l.stockStatus === "in_stock"
                            ? colors.success + "22"
                            : colors.warning + "22",
                        borderRadius: 8,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        marginTop: 2,
                      }}
                    >
                      <Text
                        style={{
                          color:
                            l.stockStatus === "in_stock"
                              ? colors.success
                              : colors.warning,
                          fontSize: 10,
                          fontWeight: "600",
                        }}
                      >
                        {l.stockStatus === "in_stock"
                          ? "In Stock"
                          : l.stockStatus === "back_order"
                            ? "Back Order"
                            : l.stockStatus === "unknown"
                              ? "Unknown"
                              : "Out of Stock"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
