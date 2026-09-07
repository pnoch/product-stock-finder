import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ScrollView,
  View,
  Platform,
  useWindowDimensions,
  Text,
  TouchableOpacity,
  Share,
  Animated,
} from "react-native";
import * as Linking from "expo-linking";
import { buildShareText } from "@/lib/price-share";
import { captureAndShareImage } from "@/lib/share-image";
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
import { useLiveProduct } from "@/hooks/use-live-prices";
import { addAlert, getSettings } from "@/lib/storage";
import {
  schedulePriceAlert,
  requestNotificationPermissions,
} from "@/lib/notifications";
import { PriceAlert } from "@/lib/types";
import { formatPrice } from "@shared/currency";
import { convertPrice } from "@/lib/currency";
import { getDistributorById } from "@shared/distributors";
import { PRODUCT_CATALOG } from "@shared/catalog";
import { SkeletonChart, SkeletonList } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { EmptyStateView } from "@/components/ui/empty-state-view";
import { useColors } from "@/hooks/use-colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  CHART_COLORS,
  TimeRange,
  SortBy,
  filterByRange,
} from "@shared/compare-utils";

const LOG_ERROR = __DEV__ ? console.error.bind(console) : () => {};

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─── Compare Screen ───────────────────────────────────────────────────────────
export default function CompareScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [timeRange, setTimeRange] = useState<TimeRange>("3M");
  const [sortBy, setSortBy] = useState<SortBy>("trend");
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const { product, listings, loaded, isRefreshingAny, refresh } =
    useLiveProduct(id ?? "");
  const productName =
    product?.name ??
    PRODUCT_CATALOG.find((p) => p.id === id)?.name ??
    (id ?? "");
  const notFound = loaded && !product && listings.length === 0;
  const { width: windowWidth } = useWindowDimensions();
  const [chartWidth, setChartWidth] = useState(windowWidth - 64);
  useEffect(() => {
    setChartWidth(windowWidth - 64);
  }, [windowWidth]);

  useEffect(() => {
    getSettings().then((s) => {
      if (s?.displayCurrency) setDisplayCurrency(s.displayCurrency);
    });
  }, []);

  const selectionInitialized = useRef<string | null>(null);
  useEffect(() => {
    const key = `${id ?? ""}-${displayCurrency}`;
    if (!loaded || !id || selectionInitialized.current === key) return;
    if (selected.size > 0) return;
    selectionInitialized.current = key;
    const withHistory = listings.filter(
      (l) => l.priceHistory && l.priceHistory.length >= 2,
    );
    const sortedByPrice = [...withHistory].sort((a, b) => {
      const pa = convertPrice(a.price, a.currency, displayCurrency);
      const pb = convertPrice(b.price, b.currency, displayCurrency);
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return pa - pb;
    });
    setSelected(new Set(sortedByPrice.slice(0, 3).map((l) => l.distributorId)));
    // Intentional one-time init per product/currency (guarded by
    // selectionInitialized + the selected.size early-return above): re-running
    // on selection changes would reseed after the user deselects all.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, listings, id, displayCurrency]);

  const toggleSelect = useCallback((distributorId: string) => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(distributorId)) {
        next.delete(distributorId);
      } else if (next.size < 5) {
        next.add(distributorId);
      } else {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showToast("You can compare up to 5 distributors", "info");
      }
      return next;
    });
  }, [showToast]);

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
    for (const l of inStock) {
      const converted = convertPrice(l.price, l.currency, displayCurrency);
      if (converted == null || !isFinite(converted)) continue;
      if (converted < bestPrice) {
        bestPrice = converted;
      }
    }
    if (!isFinite(bestPrice)) {
      showAlert("Unable to compare prices", "Currency conversion unavailable. Try switching display currency.");
      return;
    }
    const targetPrice = parseFloat((bestPrice * 0.95).toFixed(2));
    const granted = await requestNotificationPermissions();
    if (!granted) {
      showAlert(
        "Permission Denied",
        "Please enable notifications in your device settings to receive price alerts.",
      );
      return;
    }
    if (!id) return;
    const alert: PriceAlert = {
      id: `cross-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: id,
      // sentinel: watch any distributor (cross-distributor alert) rather than single best only
      // per-distributor alternative would loop inStock and create one alert per distributorId
      distributorId: undefined,
      targetPrice,
      currency: displayCurrency,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    await addAlert(alert);
    await schedulePriceAlert(productName || "Product", targetPrice, displayCurrency, id);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(`Alert created — watching below ${formatPrice(targetPrice, displayCurrency)}`, "success");
  }, [listings, id, productName, displayCurrency, showToast]);

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
      return ls.sort((a, b) => {
        const pa = convertPrice(a.price, a.currency, displayCurrency);
        const pb = convertPrice(b.price, b.currency, displayCurrency);
        if (pa === null && pb === null) return 0;
        if (pa === null) return 1;
        if (pb === null) return -1;
        return pa - pb;
      });
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
  }, [listings, sortBy, priceTrends, displayCurrency]);

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const stickyOpacity = scrollY.interpolate({ inputRange: [80, 140], outputRange: [0, 1], extrapolate: "clamp" });
  const shareScale = useRef(new Animated.Value(1)).current;
  const shareRef = useRef<View>(null);
  const handleShare = useCallback(async () => {
    if (!product || !id) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.sequence([
        Animated.timing(shareScale, { toValue: 0.85, duration: 90, useNativeDriver: true }),
        Animated.spring(shareScale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 8 }),
      ]).start();
    }
    const shareText = buildShareText({ product, listings, displayCurrency, limit: 5 });
    const deepLink = Linking.createURL(`/product/${id}`, { scheme: "productstockfinder" });
    const message = `${shareText}\n\n${deepLink}`;
    try {
      const imageShared = await captureAndShareImage(shareRef as React.RefObject<View | null>, `compare-${id}`);
      if (imageShared) {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
    } catch (e) {
      LOG_ERROR("[Compare] image share failed, falling back to text", e);
    }
    try {
      const result = await Share.share({ message, title: product.name });
      if ((result as unknown as { action: string })?.action === Share.dismissedAction) return;
    } catch {
      return;
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [product, listings, displayCurrency, id, shareScale]);

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
      return {
        label: distributor?.name ?? l.distributorId,
        color: CHART_COLORS[hashId(l.distributorId) % CHART_COLORS.length],
        data: filtered,
        currency: l.currency,
      };
    });
  }, [listings, selected, timeRange]);

  if (!id) return null;

  return (
    <ScreenContainer>
      {!loaded ? (
        <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 40 }}>
          <SkeletonChart />
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <SkeletonList count={3} />
          </View>
        </ScrollView>
      ) : notFound ? (
        <EmptyStateView
          icon="magnifyingglass"
          title="Product not found"
          subtitle="We couldn't find this product — check the link or browse your watchlist."
          ctaLabel="Try Again"
          onCtaPress={() => refresh()}
          secondaryLabel="Go back"
          onSecondaryPress={() => router.back()}
        />
      ) : (
        <>
          <Animated.View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              paddingHorizontal: 16,
              paddingVertical: 10,
              paddingTop: insets.top + 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              opacity: stickyOpacity,
            }}
          >
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14, flex: 1 }} numberOfLines={1}>
              {productName}
            </Text>
            <View pointerEvents="auto">
              <TouchableOpacity activeOpacity={0.7} onPress={handleShare} style={{ padding: 4, marginLeft: 8 }} accessibilityLabel="Share comparison" accessibilityRole="button">
                <IconSymbol name="square.and.arrow.up" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </Animated.View>
          <Animated.ScrollView
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
          >
            {/* Header */}
            <CompareHeader
              productName={productName}
              isRefreshing={isRefreshingAny}
              onRefresh={refresh}
              onBack={() => router.back()}
            />

            <View
              ref={shareRef}
              collapsable={false}
              pointerEvents="box-none"
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                if (w > 0) setChartWidth(w - 32);
              }}
            >
              <View pointerEvents="auto">
                <ChartCard
                  timeRange={timeRange}
                  onRangeChange={setRange}
                  chartSeries={chartSeries}
                  chartWidth={chartWidth}
                  displayCurrency={displayCurrency}
                />
              </View>
            </View>

            {/* Cheapest Region summary */}
            <CheapestRegionCard listings={listings} displayCurrency={displayCurrency} />

            <CrossAlertCTA listings={listings} displayCurrency={displayCurrency} onPress={handleCrossAlert} />

            <CurrentPricesTable listings={listings} selected={selected} displayCurrency={displayCurrency} />

            <DistributorSelector
              sortedListings={sortedListings}
              selected={selected}
              sortBy={sortBy}
              onSortChange={setSortByMode}
              onToggle={toggleSelect}
              priceTrends={priceTrends}
            />
          </Animated.ScrollView>
        </>
      )}
    </ScreenContainer>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
