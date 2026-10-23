import { useCallback, useMemo, useRef, useState } from "react";
import { Animated, Platform, View, useWindowDimensions } from "react-native";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { buildShareText } from "@/lib/price-share";
import { shareText as shareTextCrossPlatform } from "@/lib/share-text";
import { captureAndShareImage } from "@/lib/share-image";
import { priceHistoryToCsv } from "@/lib/csv";
import { exportCsvFile } from "@/lib/csv-export";
import { showAlert } from "@/lib/alert";
import { useLiveProduct } from "@/hooks/use-live-prices";
import { createPriceAlert } from "@/lib/create-price-alert";
import { useSettings } from "@/lib/settings-provider";
import { formatPrice } from "@shared/currency";
import { convertPrice } from "@/lib/currency";
import { getDistributorById } from "@shared/distributors";
import { PRODUCT_CATALOG } from "@shared/catalog";
import { useToast } from "@/components/ui/toast";
import { useColors } from "@/hooks/use-colors";
import {
  distributorColor,
  TimeRange,
  SortBy,
  filterByRange,
} from "@shared/compare-utils";
import { LOG_ERROR, log } from "@shared/log";

const EMPTY_SELECTION = new Set<string>();

export function useCompareScreen() {
  const { id: rawId, distributor: rawDistributor } = useLocalSearchParams<{
    id: string;
    distributor?: string | string[];
  }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const distributorParam = Array.isArray(rawDistributor)
    ? rawDistributor[0]
    : rawDistributor;
  const router = useRouter();
  const { showToast } = useToast();
  const [userSelected, setUserSelected] = useState<Set<string> | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("3M");
  const [sortBy, setSortBy] = useState<SortBy>("trend");
  const { settings } = useSettings();
  const displayCurrency = settings.displayCurrency;
  const [creatingAlert, setCreatingAlert] = useState(false);
  const { product, listings, loaded, isRefreshingAny, refresh } =
    useLiveProduct(id ?? "");
  const productName =
    product?.name ??
    PRODUCT_CATALOG.find((p) => p.id === id)?.name ??
    (id ?? "");
  const notFound = loaded && !product && listings.length === 0;
  const { width: windowWidth } = useWindowDimensions();
  const [measuredChartWidth, setMeasuredChartWidth] = useState<number | null>(null);
  const chartWidth = measuredChartWidth ?? windowWidth - 64;

  const computedDefault = useMemo(() => {
    if (!loaded || !id) return new Set<string>();
    if (distributorParam && listings.some((l) => l.distributorId === distributorParam)) {
      return new Set([distributorParam]);
    }
    const withHistory = listings.filter(
      (l) => l.priceHistory && l.priceHistory.length >= 2,
    );
    if (withHistory.length === 0) return new Set<string>();
    const sortedByPrice = [...withHistory].sort((a, b) => {
      const pa = convertPrice(a.price, a.currency, displayCurrency);
      const pb = convertPrice(b.price, b.currency, displayCurrency);
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return pa - pb;
    });
    return new Set(sortedByPrice.slice(0, 3).map((l) => l.distributorId));
  }, [loaded, id, distributorParam, listings, displayCurrency]);

  const selectionKey = `${id ?? ""}-${displayCurrency}`;
  const [latchedDefault, setLatchedDefault] = useState<Set<string> | null>(null);
  const [prevSelectionKey, setPrevSelectionKey] = useState(selectionKey);
  if (selectionKey !== prevSelectionKey) {
    setPrevSelectionKey(selectionKey);
    setLatchedDefault(null);
  }
  if (latchedDefault === null && computedDefault.size > 0) {
    setLatchedDefault(computedDefault);
  }

  const selected = userSelected ?? latchedDefault ?? EMPTY_SELECTION;

  const toggleSelect = useCallback(
    (distributorId: string) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setUserSelected((prev) => {
        const next = new Set(prev ?? latchedDefault ?? new Set<string>());
        if (next.has(distributorId)) {
          next.delete(distributorId);
        } else if (next.size < 5) {
          next.add(distributorId);
        } else {
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
          showToast("You can compare up to 5 distributors", "info");
        }
        return next;
      });
    },
    [latchedDefault, showToast],
  );

  const setRange = useCallback((r: TimeRange) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setTimeRange(r);
  }, []);

  const setSortByMode = useCallback((s: SortBy) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSortBy(s);
  }, []);

  const handleCrossAlert = useCallback(async () => {
    if (creatingAlert) return;
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
      if (converted < bestPrice) bestPrice = converted;
    }
    if (!isFinite(bestPrice)) {
      showAlert(
        "Unable to compare prices",
        "Currency conversion unavailable. Try switching display currency.",
      );
      return;
    }
    if (!id) return;
    const targetPrice = parseFloat((bestPrice * 0.95).toFixed(2));
    setCreatingAlert(true);
    try {
      const result = await createPriceAlert({
        productId: id,
        productName: productName || "Product",
        targetPrice,
        currency: displayCurrency,
      });
      if (result.reason === "permission") {
        showAlert(
          "Permission Denied",
          Platform.OS === "web"
            ? "Please allow notifications in your browser to receive price alerts."
            : "Please enable notifications in your device settings to receive price alerts.",
        );
        return;
      }
      if (result.reason === "duplicate") {
        showToast("That alert already exists", "info");
        return;
      }
      if (!result.saved) {
        showAlert(
          "Couldn't create alert",
          "We couldn't save your price alert. Please try again.",
        );
        return;
      }
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      showToast(
        result.scheduled
          ? `Alert created — watching below ${formatPrice(targetPrice, displayCurrency)}`
          : "Alert saved — enable notifications to get push alerts",
        result.scheduled ? "success" : "info",
      );
    } catch (e) {
      log.error("[Compare] alert creation failed", e);
      showAlert("Couldn't create alert", "We couldn't save your price alert. Please try again.");
    } finally {
      setCreatingAlert(false);
    }
  }, [listings, id, productName, displayCurrency, showToast, creatingAlert]);

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
    if (sortBy === "price") {
      return ls.sort((a, b) => {
        const pa = convertPrice(a.price, a.currency, displayCurrency);
        const pb = convertPrice(b.price, b.currency, displayCurrency);
        if (pa === null && pb === null) return 0;
        if (pa === null) return 1;
        if (pb === null) return -1;
        return pa - pb;
      });
    }
    if (sortBy === "name") {
      return ls.sort((a, b) =>
        (getDistributorById(a.distributorId)?.name ?? a.distributorId).localeCompare(
          getDistributorById(b.distributorId)?.name ?? b.distributorId,
        ),
      );
    }
    return ls.sort((a, b) => {
      const ta = priceTrends.get(a.distributorId);
      const tb = priceTrends.get(b.distributorId);
      const scoreA = ta?.dir === "down" ? ta.pct : ta?.dir === "up" ? -ta.pct : 0;
      const scoreB = tb?.dir === "down" ? tb.pct : tb?.dir === "up" ? -tb.pct : 0;
      return scoreB - scoreA;
    });
  }, [listings, sortBy, priceTrends, displayCurrency]);

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scrollY = useState(() => new Animated.Value(0))[0];
  const stickyOpacity = scrollY.interpolate({
    inputRange: [80, 140],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const shareScale = useState(() => new Animated.Value(1))[0];
  const shareRef = useRef<React.ComponentRef<typeof View>>(null);

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
    const deepLink = Linking.createURL(`/product/${encodeURIComponent(id)}`, {
      scheme: "productstockfinder",
    });
    const message = `${shareText}\n\n${deepLink}`;
    try {
      const imageShared = await captureAndShareImage(shareRef, `compare-${id}`);
      if (imageShared) {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        return;
      }
    } catch (e) {
      LOG_ERROR("[Compare] image share failed, falling back to text", e);
    }
    const result = await shareTextCrossPlatform(message, product.name);
    if (result === "dismissed") return;
    if (result === "copied") {
      showToast("Copied to clipboard", "success");
    } else if (result === "failed") {
      showAlert("Share unavailable", "Sharing isn't supported in this browser.");
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [product, listings, displayCurrency, id, shareScale, showToast]);

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
        color: distributorColor(l.distributorId),
        data: filtered,
        currency: l.currency,
      };
    });
  }, [listings, selected, timeRange]);

  const handleExportCsv = useCallback(async () => {
    if (!id) return;
    const withHistory = listings.filter(
      (l) => l.priceHistory && l.priceHistory.length > 0,
    );
    if (withHistory.length === 0) {
      showAlert("Nothing to export", "No price history is available for this product yet.");
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const rows = withHistory
      .flatMap((l) =>
        (l.priceHistory ?? []).map((pt) => ({
          ...pt,
          distributor: getDistributorById(l.distributorId)?.name ?? l.distributorId,
        })),
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const csv = priceHistoryToCsv(rows, {
      name: productName,
      modelNumber: product?.modelNumber ?? id,
    });
    const ok = await exportCsvFile(
      csv,
      `${id}-price-history-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    if (!ok) {
      showAlert("Export unavailable", "We couldn't export the price history on this device.");
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    showToast("Price history exported", "success");
  }, [id, listings, productName, product, showToast]);

  return {
    id,
    router,
    product,
    listings,
    loaded,
    isRefreshingAny,
    refresh,
    productName,
    notFound,
    displayCurrency,
    timeRange,
    setRange,
    sortBy,
    setSortByMode,
    selected,
    toggleSelect,
    priceTrends,
    sortedListings,
    handleCrossAlert,
    handleShare,
    handleExportCsv,
    chartSeries,
    chartWidth,
    setMeasuredChartWidth,
    colors,
    insets,
    scrollY,
    stickyOpacity,
    shareScale,
    shareRef,
  };
}
