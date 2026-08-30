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
import { CurrentPricesTable } from "@/components/compare/current-prices-table";
import { CrossAlertCTA } from "@/components/compare/cross-alert-cta";
import { DistributorSelector } from "@/components/compare/distributor-selector";
import { useColors } from "@/hooks/use-colors";
import { useLiveProduct } from "@/hooks/use-live-prices";
import { addAlert, getSettings } from "@/lib/storage";
import {
  schedulePriceAlert,
  requestNotificationPermissions,
} from "@/lib/notifications";
import { PriceAlert } from "@/lib/types";
import { convertPrice, CURRENCY_SYMBOLS } from "@/lib/currency";
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
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const { product, listings, loaded, isRefreshingAny, refresh } =
    useLiveProduct(id);
  const productName =
    product?.name ??
    PRODUCT_CATALOG.find((p) => p.id === id)?.name ??
    (id as string);
  const notFound = loaded && !product && listings.length === 0;
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = windowWidth - 32;

  useEffect(() => {
    getSettings().then((s) => {
      if (s?.displayCurrency) setDisplayCurrency(s.displayCurrency);
    });
  }, []);

  const selectionInitialized = useRef<string | null>(null);
  useEffect(() => {
    if (!loaded || selectionInitialized.current === id) return;
    selectionInitialized.current = id as string;
    const withHistory = listings.filter(
      (l) => l.priceHistory && l.priceHistory.length >= 2,
    );
    setSelected(new Set(withHistory.slice(0, 3).map((l) => l.distributorId)));
  }, [loaded, listings, id]);

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
    let bestPrice = Infinity;
    let bestListing = inStock[0]!;
    for (const l of inStock) {
      const converted = convertPrice(l.price, l.currency, displayCurrency);
      if (converted < bestPrice) {
        bestPrice = converted;
        bestListing = l;
      }
    }
    const targetPrice = parseFloat((bestPrice * 0.95).toFixed(2));
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
      id: `cross-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: id as string,
      distributorId: bestListing.distributorId,
      targetPrice,
      currency: displayCurrency,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    await addAlert(alert);
    await schedulePriceAlert(productName || "Product", targetPrice, displayCurrency, id);
    const sym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency;
    showAlert(
      "Alert Set!",
      `You'll be notified when any distributor drops below ${sym}${targetPrice.toFixed(2)} (5% below current best of ${sym}${bestPrice.toFixed(2)} at ${dist?.name ?? bestListing.distributorId}).`,
    );
  }, [listings, id, productName, displayCurrency]);

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
          convertPrice(a.price, a.currency, displayCurrency) -
          convertPrice(b.price, b.currency, displayCurrency),
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
            displayCurrency={displayCurrency}
          />

          {/* Cheapest Region summary */}
          <CheapestRegionCard listings={listings} />

          <CrossAlertCTA listings={listings} onPress={handleCrossAlert} />

          <CurrentPricesTable listings={listings} selected={selected} />

          <DistributorSelector
            sortedListings={sortedListings}
            selected={selected}
            sortBy={sortBy}
            onSortChange={setSortByMode}
            onToggle={toggleSelect}
            priceTrends={priceTrends}
          />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
