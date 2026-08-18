import { useCallback, useEffect, useState, useMemo } from "react";
import * as Clipboard from "expo-clipboard";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  Linking,
  ActivityIndicator,
  Share,
  Platform,
  Dimensions,
  Image,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLiveProduct } from "@/hooks/use-live-prices";
import {
  getWatchlist,
  addAlert,
  getStockWatches,
  addStockWatch,
  removeStockWatch,
  updateStockWatchStatus,
  getSettings,
  addBackOrderReminder,
  getBackOrderReminders,
} from "@/lib/storage";
import {
  DistributorListing,
  PriceAlert,
  PricePoint,
} from "@/lib/types";
import {
  formatPrice,
  convertPrice,
  getBestPrice,
  EXCHANGE_RATES,
} from "@/lib/currency";
import {
  formatLastRefreshed,
  getLastRefreshedColor,
} from "@/lib/last-refreshed";
import { getDistributorById } from "@/lib/distributors";
import { getAllRegions, filterListingsByRegion } from "@/lib/region-filter";
import { findBestDeal } from "@/lib/best-deal";
import { findNearestIndex } from "@/lib/price-chart";
import { fetchPriceInsight } from "@/lib/server-insights";
import { fetchProductImage } from "@/lib/server-images";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  schedulePriceAlert,
  requestNotificationPermissions,
  scheduleBackOrderReminder,
  scheduleStockAlert,
  cancelNotification,
} from "@/lib/notifications";
import DateTimePicker from "@react-native-community/datetimepicker";
import { PriceSparkline } from "@/components/price-sparkline";
import { SAMPLE_LISTINGS } from "@/lib/sample-data";
import Svg, {
  Polyline,
  Circle,
  Line,
  Text as SvgText,
  Rect,
} from "react-native-svg";

// ─── Best Distributor Highlight Card ─────────────────────────────────────────
function BestDistributorCard({
  listing,
  onSetAlert,
  product: prod,
}: {
  listing: DistributorListing;
  onSetAlert: () => void;
  product: { name: string } | null;
}) {
  const colors = useColors();
  const distributor = getDistributorById(listing.distributorId);
  const usdPrice = convertPrice(listing.price, listing.currency, "USD");

  // Price-drop indicator: compare oldest vs current price in history
  const priceTrend = (() => {
    const hist = listing.priceHistory;
    if (!hist || hist.length < 2) return null;
    const sorted = [...hist].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const oldest = sorted[0].price;
    const current = sorted[sorted.length - 1].price;
    if (current < oldest) {
      const pct = Math.round(((oldest - current) / oldest) * 100);
      return { dir: "down" as const, pct };
    }
    if (current > oldest) {
      const pct = Math.round(((current - oldest) / oldest) * 100);
      return { dir: "up" as const, pct };
    }
    return null;
  })();

  // Lowest Price Ever: compare current price against minimum across all history points
  const isLowestEver = (() => {
    const hist = listing.priceHistory;
    if (!hist || hist.length < 2) return false;
    // Convert all prices to USD for fair comparison
    const historicalMin = Math.min(
      ...hist.map((p) => convertPrice(p.price, p.currency, "USD")),
    );
    const currentUsd = convertPrice(listing.price, listing.currency, "USD");
    return currentUsd <= historicalMin;
  })();

  return (
    <View
      style={{
        backgroundColor: colors.primary + "12",
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: colors.primary + "55",
      }}
    >
      {/* Crown badge */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
        }}
      >
        <View
          style={{
            backgroundColor: "#F59E0B",
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <IconSymbol name="crown.fill" size={12} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
            BEST PRICE
          </Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
          Cheapest in-stock option
        </Text>
        {priceTrend && (
          <View
            style={{
              backgroundColor:
                priceTrend.dir === "down"
                  ? colors.success + "22"
                  : colors.error + "22",
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 3,
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Text
              style={{
                color:
                  priceTrend.dir === "down" ? colors.success : colors.error,
                fontSize: 11,
                fontWeight: "700",
              }}
            >
              {priceTrend.dir === "down" ? "▼" : "▲"} {priceTrend.pct}%
            </Text>
          </View>
        )}
      </View>
      {isLowestEver && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            backgroundColor: colors.success + "18",
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 5,
            marginBottom: 10,
            alignSelf: "flex-start",
            borderWidth: 1,
            borderColor: colors.success + "44",
          }}
        >
          <Text style={{ fontSize: 14 }}>🎉</Text>
          <Text
            style={{ color: colors.success, fontSize: 12, fontWeight: "700" }}
          >
            Lowest Price Ever
          </Text>
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "700",
              fontSize: 15,
            }}
          >
            {distributor?.countryFlag}{" "}
            {distributor?.name ?? listing.distributorId}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
            {distributor?.country} · {distributor?.region}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: colors.success + "22",
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text
            style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}
          >
            ● In Stock
          </Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 10,
        }}
      >
        <View>
          <Text
            style={{ color: colors.primary, fontWeight: "700", fontSize: 22 }}
          >
            {formatPrice(listing.price, listing.currency)}
          </Text>
          {listing.currency !== "USD" && (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              ≈ {formatPrice(usdPrice, "USD")}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            openListingUrl(listing.url);
          }}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 20,
            paddingHorizontal: 18,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
            Buy Now
          </Text>
          <IconSymbol name="arrow.up.right.square" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
      {distributor?.paymentMethods && (
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>
          💳 {distributor.paymentMethods.join(" · ")}
        </Text>
      )}
      {/* Quick-set price alert row */}
      {(() => {
        const suggestedPrice = Math.round(listing.price * 0.95 * 100) / 100;
        return (
          <TouchableOpacity
            onPress={onSetAlert}
            style={{
              marginTop: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: colors.primary + "12",
              borderRadius: 12,
              paddingVertical: 9,
              borderWidth: 1,
              borderColor: colors.primary + "44",
            }}
          >
            <IconSymbol name="bell.fill" size={14} color={colors.primary} />
            <Text
              style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}
            >
              Set Alert at {formatPrice(suggestedPrice, listing.currency)} (−5%)
            </Text>
          </TouchableOpacity>
        );
      })()}
    </View>
  );
}

function StockBadge({
  status,
  expectedDate,
}: {
  status: string;
  expectedDate?: string;
}) {
  const colors = useColors();
  const config: Record<string, { bg: string; text: string; label: string }> = {
    in_stock: {
      bg: colors.success + "22",
      text: colors.success,
      label: "In Stock",
    },
    back_order: {
      bg: colors.warning + "22",
      text: colors.warning,
      label: `Back Order${expectedDate ? ` · ${expectedDate}` : ""}`,
    },
    out_of_stock: {
      bg: colors.error + "22",
      text: colors.error,
      label: "Out of Stock",
    },
    unknown: { bg: colors.muted + "22", text: colors.muted, label: "Unknown" },
  };
  const c = config[status] ?? config.unknown;
  return (
    <View
      style={{
        backgroundColor: c.bg,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ color: c.text, fontSize: 12, fontWeight: "600" }}>
        ● {c.label}
      </Text>
    </View>
  );
}

async function openListingUrl(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      showAlert("Cannot Open Link", "No app is available to open this URL.");
      return;
    }
    await Linking.openURL(url);
  } catch {
    showAlert(
      "Error",
      "Could not open the distributor link. Please try again later.",
    );
  }
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const { product, listings, loaded, isRefreshingAny, lastUpdatedAt, refresh } =
    useLiveProduct(id);
  const [insight, setInsight] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCurrency, setAlertCurrency] = useState("USD");
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [shippingRegion, setShippingRegion] = useState("Asia-Pacific");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const regions = useMemo(() => getAllRegions(), []);

  // Best in-stock distributor (cheapest by USD equivalent)
  // Reminder modal state
  const [reminderListing, setReminderListing] =
    useState<DistributorListing | null>(null);
  const [reminderDate, setReminderDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Back-in-stock watch state
  const [stockWatches, setStockWatches] = useState<Record<string, boolean>>({});

  // Price history chart modal state
  const [chartListing, setChartListing] = useState<DistributorListing | null>(
    null,
  );
  const chartWidth = Dimensions.get("window").width - 48;
  const chartHeight = 200;

  const loadData = useCallback(async () => {
    void fetchPriceInsight(id).then((res) => {
      if (res) setInsight(res.insight);
    });
    void fetchProductImage(id).then((res) => {
      if (res) setProductImage(res.imageUrl);
    });
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load stock watches and poll for status changes on focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function pollStockWatches() {
        // Load preferred currency from settings
        const settings = await getSettings();
        if (active) {
          setDisplayCurrency(settings.displayCurrency ?? "USD");
          setAlertCurrency(settings.displayCurrency ?? "USD");
          setShippingRegion(settings.shippingRegion ?? "Asia-Pacific");
        }

        const watches = await getStockWatches();
        const productWatches = watches.filter((w) => w.productId === id);
        // Build a map of distributorId -> isWatched
        const watchMap: Record<string, boolean> = {};
        for (const w of productWatches) watchMap[w.distributorId] = true;
        if (active) setStockWatches(watchMap);

        // Poll: check if any watched distributor has come back in stock
        const watchlist = await getWatchlist();
        const found = watchlist.find((p) => p.id === id);
        if (!found) return;
        const currentListings = found.listings?.length
          ? found.listings
          : (SAMPLE_LISTINGS[id] ?? []);
        for (const watch of productWatches) {
          const currentListing = currentListings.find(
            (l) => l.distributorId === watch.distributorId,
          );
          if (!currentListing) continue;
          const prevStatus = watch.lastKnownStatus ?? "back_order";
          const newStatus = currentListing.stockStatus;
          if (prevStatus !== "in_stock" && newStatus === "in_stock") {
            // Status changed to in-stock — fire notification and remove watch
            if (Platform.OS !== "web") {
              await requestNotificationPermissions();
              const distrib = getDistributorById(watch.distributorId);
              await scheduleStockAlert(
                watch.productName,
                distrib?.name ?? watch.distributorName,
                currentListing.price,
                currentListing.currency,
              );
            }
            await removeStockWatch(watch.id);
            if (active)
              setStockWatches((prev) => {
                const n = { ...prev };
                delete n[watch.distributorId];
                return n;
              });
          } else if (prevStatus !== newStatus) {
            // Update cached status
            await updateStockWatchStatus(id, watch.distributorId, newStatus);
          }
        }
      }
      pollStockWatches();
      return () => {
        active = false;
      };
    }, [id]),
  );

  const handleToggleStockWatch = useCallback(
    async (listing: DistributorListing) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const isWatching = stockWatches[listing.distributorId];
      if (isWatching) {
        // Remove watch
        const watches = await getStockWatches();
        const existing = watches.find(
          (w) =>
            w.productId === id && w.distributorId === listing.distributorId,
        );
        if (existing) {
          if (existing.notificationId)
            await cancelNotification(existing.notificationId);
          await removeStockWatch(existing.id);
        }
        setStockWatches((prev) => {
          const n = { ...prev };
          delete n[listing.distributorId];
          return n;
        });
        showAlert(
          "Watch Removed",
          `You'll no longer be notified when ${getDistributorById(listing.distributorId)?.name ?? listing.distributorId} gets ${product?.name} back in stock.`,
        );
      } else {
        // Add watch
        const distributor = getDistributorById(listing.distributorId);
        const watchEntry = {
          id: `watch-${Date.now()}-${listing.distributorId}`,
          productId: id,
          productName: product?.name ?? "Product",
          distributorId: listing.distributorId,
          distributorName: distributor?.name ?? listing.distributorId,
          reminderDate: new Date().toISOString(),
          reminderType: "back_in_stock" as const,
          lastKnownStatus: listing.stockStatus,
          createdAt: new Date().toISOString(),
        };
        await addStockWatch(watchEntry);
        setStockWatches((prev) => ({ ...prev, [listing.distributorId]: true }));
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert(
          "Watching for Restock 👀",
          `You'll be notified the next time you open the app and ${distributor?.name ?? listing.distributorId} has ${product?.name} back in stock.`,
        );
      }
    },
    [stockWatches, id, product],
  );

  const handleSetAlert = useCallback(async () => {
    const price = parseFloat(alertPrice);
    if (isNaN(price) || price <= 0) {
      showAlert("Invalid Price", "Please enter a valid target price.");
      return;
    }
    const newAlert: PriceAlert = {
      id: `alert-${Date.now()}`,
      productId: id,
      targetPrice: price,
      currency: alertCurrency,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    await addAlert(newAlert);
    // Schedule a confirmation notification so the user knows the alert is active
    await requestNotificationPermissions();
    await schedulePriceAlert(product?.name ?? "Product", price, alertCurrency);
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAlertModalVisible(false);
    setAlertPrice("");
    showAlert(
      "Alert Set",
      `You'll be notified when the price drops below ${formatPrice(price, alertCurrency)}.`,
    );
  }, [alertPrice, alertCurrency, id, product]);

  const sortedListings = [...listings].sort((a, b) => {
    const order = { in_stock: 0, back_order: 1, out_of_stock: 2, unknown: 3 };
    return (order[a.stockStatus] ?? 3) - (order[b.stockStatus] ?? 3);
  });

  const visibleListings =
    regionFilter === "all"
      ? sortedListings
      : filterListingsByRegion(sortedListings, regionFilter);

  const bestInStockListing = (() => {
    const inStock = visibleListings.filter((l) => l.stockStatus === "in_stock");
    if (inStock.length === 0) return null;
    return inStock.reduce((best, l) =>
      convertPrice(l.price, l.currency, "USD") <
      convertPrice(best.price, best.currency, "USD")
        ? l
        : best,
    );
  })();

  const bestDeal = useMemo(
    () => findBestDeal(visibleListings, shippingRegion, displayCurrency),
    [visibleListings, shippingRegion, displayCurrency],
  );

  const handleShare = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const inStockListings = sortedListings.filter(
      (l) => l.stockStatus === "in_stock",
    );
    const bestListing = inStockListings[0] ?? sortedListings[0];
    const distributor = bestListing
      ? getDistributorById(bestListing.distributorId)
      : null;
    const priceStr = bestListing
      ? formatPrice(bestListing.price, bestListing.currency)
      : "N/A";
    const statusStr =
      inStockListings.length > 0
        ? `✅ In Stock at ${distributor?.name ?? "a distributor"} for ${priceStr}`
        : `⏳ Back Order — best price ${priceStr}`;
    const url = bestListing?.url ?? "";
    const message = `${product?.name} (${product?.modelNumber})\n${statusStr}\n${url}`;
    try {
      await Share.share({ message, title: product?.name ?? "Product" });
    } catch {
      // User cancelled share — no action needed
    }
  }, [product, sortedListings]);

  const handleCopyLink = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const inStockListings = sortedListings.filter(
      (l) => l.stockStatus === "in_stock",
    );
    const bestListing = inStockListings[0] ?? sortedListings[0];
    const url = bestListing?.url ?? "";
    if (!url) {
      showAlert("No Link", "No distributor URL available to copy.");
      return;
    }
    await Clipboard.setStringAsync(url);
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert(
      "Link Copied!",
      "The distributor URL has been copied to your clipboard.",
    );
  }, [sortedListings]);

  const handleTestStockNotification = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "web") {
      showAlert(
        "Not Available",
        "Push notifications are only available on iOS and Android devices.",
      );
      return;
    }
    const granted = await requestNotificationPermissions();
    if (!granted) {
      showAlert(
        "Permission Denied",
        "Please enable notifications in your device settings to receive stock alerts.",
      );
      return;
    }
    const inStockListing = sortedListings.find(
      (l) => l.stockStatus === "in_stock",
    );
    const targetListing = inStockListing ?? sortedListings[0];
    const distributor = targetListing
      ? getDistributorById(targetListing.distributorId)
      : null;
    await scheduleStockAlert(
      product?.name ?? "Product",
      distributor?.name ?? "a distributor",
      targetListing?.price ?? 0,
      targetListing?.currency ?? "USD",
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert(
      "Notification Sent!",
      `A "Back In Stock" alert for ${product?.name} has been sent to your device.`,
    );
  }, [product, sortedListings]);

  const handleSetReminder = useCallback(async () => {
    if (!reminderListing || !product) return;
    const distributor = getDistributorById(reminderListing.distributorId);
    const distributorName = distributor?.name ?? reminderListing.distributorId;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Cancel old notification if one exists for this product+distributor combo
    const existing = (await getBackOrderReminders()).find(
      (r) =>
        r.productId === product.id &&
        r.distributorId === reminderListing.distributorId,
    );
    if (existing?.notificationId) {
      await cancelNotification(existing.notificationId);
    }
    const notifId = await scheduleBackOrderReminder(
      product.name,
      distributorName,
      reminderDate,
    );
    await addBackOrderReminder({
      id: existing?.id ?? `reminder-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      distributorId: reminderListing.distributorId,
      distributorName,
      reminderDate: reminderDate.toISOString(),
      notificationId: notifId ?? undefined,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReminderListing(null);
    showAlert(
      "Reminder Set! 📅",
      `You'll be reminded to check ${distributorName} for ${product.name} on ${reminderDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.`,
    );
  }, [reminderListing, reminderDate, product]);

  if (!loaded) {
    return (
      <ScreenContainer>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!product) {
    return (
      <ScreenContainer>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: colors.foreground, fontSize: 16 }}>
            Product not found
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: 16 }}
          >
            <Text style={{ color: colors.primary }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 16,
            gap: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 4 }}
          >
            <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 18,
                fontWeight: "700",
              }}
              numberOfLines={2}
            >
              {product.name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
              {product.modelNumber}
            </Text>
          </View>
        </View>

        {productImage && (
          <Image
            source={{ uri: productImage }}
            style={{
              width: 96,
              height: 96,
              borderRadius: 12,
              marginBottom: 12,
            }}
          />
        )}

        {/* Product Info Card */}
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
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {product.category}
            </Text>
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
            const best = getBestPrice(visibleListings, displayCurrency);
            if (!best) return null;
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
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: "700",
                    fontSize: 14,
                    marginLeft: "auto",
                  }}
                >
                  {formatPrice(best.price, displayCurrency)}
                </Text>
              </View>
            );
          })()}
        </View>

        {/* Action Buttons */}
        <View
          style={{
            flexDirection: "row",
            marginHorizontal: 16,
            gap: 10,
            marginBottom: 20,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setAlertModalVisible(true);
            }}
            style={{
              flex: 1,
              backgroundColor: colors.primary,
              borderRadius: 14,
              paddingVertical: 13,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <IconSymbol name="bell.fill" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
              Set Price Alert
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={isRefreshingAny}
            onPress={async () => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const ok = await refresh();
              if (!ok) {
                showAlert(
                  "Couldn't refresh prices",
                  "The server is unreachable. Showing saved prices.",
                );
              }
            }}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              paddingVertical: 13,
              paddingHorizontal: 16,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              gap: 6,
            }}
          >
            {isRefreshingAny ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <IconSymbol
                name="arrow.clockwise"
                size={16}
                color={colors.foreground}
              />
            )}
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "600",
                fontSize: 15,
              }}
            >
              Refresh
            </Text>
          </TouchableOpacity>
        </View>

        {/* Distributor Listings */}
        <View style={{ paddingHorizontal: 16 }}>
          {/* Secondary Action Buttons */}
          <View style={{ flexDirection: "row", marginBottom: 16, gap: 10 }}>
            <TouchableOpacity
              onPress={handleShare}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <IconSymbol
                name="square.and.arrow.up"
                size={16}
                color={colors.foreground}
              />
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                Share
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleTestStockNotification}
              style={{
                flex: 1,
                backgroundColor: colors.success + "18",
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.success + "44",
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <IconSymbol
                name="bell.badge.fill"
                size={16}
                color={colors.success}
              />
              <Text
                style={{
                  color: colors.success,
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                Test Stock Alert
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCopyLink}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <IconSymbol
                name="doc.on.doc"
                size={16}
                color={colors.foreground}
              />
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                Copy Link
              </Text>
            </TouchableOpacity>
          </View>
          {/* Compare button */}
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/compare/${id}`);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: colors.primary + "12",
              borderRadius: 14,
              paddingVertical: 12,
              borderWidth: 1,
              borderColor: colors.primary + "44",
              marginBottom: 16,
            }}
          >
            <IconSymbol
              name="arrow.left.arrow.right"
              size={16}
              color={colors.primary}
            />
            <Text
              style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}
            >
              Compare Distributors
            </Text>
          </TouchableOpacity>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "700",
              fontSize: 16,
              marginBottom: 12,
            }}
          >
            Distributor Prices
          </Text>
          {sortedListings.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 24,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 14 }}>
                No distributor data available yet.
              </Text>
            </View>
          ) : visibleListings.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 24,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 14 }}>
                No distributors in {regionFilter}.
              </Text>
              <TouchableOpacity
                onPress={() => setRegionFilter("all")}
                style={{
                  marginTop: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 16,
                  backgroundColor: colors.primary,
                }}
              >
                <Text
                  style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}
                >
                  Show All
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {bestInStockListing && (
                <BestDistributorCard
                  listing={bestInStockListing}
                  product={product}
                  onSetAlert={async () => {
                    if (!product) return;
                    if (Platform.OS !== "web")
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    const suggestedPrice =
                      Math.round(bestInStockListing.price * 0.95 * 100) / 100;
                    const newAlert: PriceAlert = {
                      id: `alert-${Date.now()}`,
                      productId: id,
                      targetPrice: suggestedPrice,
                      currency: bestInStockListing.currency,
                      isActive: true,
                      createdAt: new Date().toISOString(),
                    };
                    await addAlert(newAlert);
                    await requestNotificationPermissions();
                    await schedulePriceAlert(
                      product.name,
                      suggestedPrice,
                      bestInStockListing.currency,
                    );
                    if (Platform.OS !== "web")
                      Haptics.notificationAsync(
                        Haptics.NotificationFeedbackType.Success,
                      );
                    showAlert(
                      "Alert Set ✅",
                      `You'll be notified when the price drops below ${formatPrice(suggestedPrice, bestInStockListing.currency)} (5% off current).`,
                    );
                  }}
                />
              )}
              {insight && (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    padding: 16,
                    marginTop: 12,
                  }}
                >
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 12,
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    AI insight
                  </Text>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 14,
                      marginTop: 4,
                      lineHeight: 20,
                    }}
                  >
                    {insight}
                  </Text>
                </View>
              )}
              {bestInStockListing && (
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 12,
                    fontWeight: "600",
                    marginBottom: 10,
                    marginTop: 4,
                    letterSpacing: 0.5,
                  }}
                >
                  ALL DISTRIBUTORS
                </Text>
              )}
              <View
                style={{
                  flexDirection: "row",
                  marginBottom: 12,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {["all", ...regions].map((region) => (
                  <TouchableOpacity
                    key={region}
                    onPress={() => setRegionFilter(region)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      backgroundColor:
                        regionFilter === region
                          ? colors.primary
                          : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          regionFilter === region ? "#fff" : colors.foreground,
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      {region === "all" ? "All" : region}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {bestDeal && (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 12,
                      fontWeight: "600",
                      letterSpacing: 0.5,
                    }}
                  >
                    BEST DEAL (incl. shipping to {shippingRegion})
                  </Text>
                  {(() => {
                    const distrib = getDistributorById(bestDeal.distributorId);
                    return (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginTop: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.foreground,
                            fontSize: 16,
                            fontWeight: "700",
                            flex: 1,
                          }}
                        >
                          {distrib?.countryFlag}{" "}
                          {distrib?.name ?? bestDeal.distributorId}
                        </Text>
                        <Text
                          style={{
                            color: colors.primary,
                            fontSize: 18,
                            fontWeight: "700",
                          }}
                        >
                          {formatPrice(bestDeal.total, bestDeal.currency)}
                        </Text>
                      </View>
                    );
                  })()}
                  <View style={{ flexDirection: "row", marginTop: 8, gap: 16 }}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Price: {formatPrice(bestDeal.price, bestDeal.currency)}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Tax:{" "}
                      {bestDeal.tax > 0
                        ? formatPrice(bestDeal.tax, bestDeal.currency)
                        : "Tax-free"}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Ship: {formatPrice(bestDeal.shipping, bestDeal.currency)}
                    </Text>
                  </View>
                </View>
              )}
              {visibleListings.map((listing) => {
                const distributor = getDistributorById(listing.distributorId);
                const usdPrice = convertPrice(
                  listing.price,
                  listing.currency,
                  "USD",
                );
                return (
                  <View
                    key={listing.distributorId}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 8,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: colors.foreground,
                            fontWeight: "600",
                            fontSize: 15,
                          }}
                        >
                          {distributor?.countryFlag}{" "}
                          {distributor?.name ?? listing.distributorId}
                        </Text>
                        <Text
                          style={{
                            color: colors.muted,
                            fontSize: 12,
                            marginTop: 2,
                          }}
                        >
                          {distributor?.country} · {distributor?.region}
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
                        alignItems: "center",
                      }}
                    >
                      <View>
                        <Text
                          style={{
                            color: colors.primary,
                            fontWeight: "700",
                            fontSize: 18,
                          }}
                        >
                          {formatPrice(listing.price, listing.currency)}
                        </Text>
                        {listing.currency !== "USD" && (
                          <Text style={{ color: colors.muted, fontSize: 12 }}>
                            ≈ {formatPrice(usdPrice, "USD")}
                          </Text>
                        )}
                        {listing.taxRate != null && listing.taxRate > 0 ? (
                          <Text style={{ color: colors.muted, fontSize: 11 }}>
                            +
                            {formatPrice(
                              listing.price * listing.taxRate,
                              listing.currency,
                            )}{" "}
                            tax
                          </Text>
                        ) : (
                          <Text style={{ color: colors.muted, fontSize: 11 }}>
                            Tax-free
                          </Text>
                        )}
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        {listing.priceHistory &&
                          listing.priceHistory.length >= 2 && (
                            <TouchableOpacity
                              onPress={() => {
                                if (Platform.OS !== "web")
                                  Haptics.impactAsync(
                                    Haptics.ImpactFeedbackStyle.Light,
                                  );
                                setChartListing(listing);
                              }}
                              activeOpacity={0.7}
                            >
                              <PriceSparkline
                                data={listing.priceHistory}
                                width={72}
                                height={28}
                                currency={listing.currency}
                              />
                            </TouchableOpacity>
                          )}
                        <TouchableOpacity
                          onPress={() => {
                            if (Platform.OS !== "web")
                              Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Light,
                              );
                            openListingUrl(listing.url);
                          }}
                          style={{
                            backgroundColor: colors.primary + "22",
                            borderRadius: 20,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.primary,
                              fontWeight: "600",
                              fontSize: 13,
                            }}
                          >
                            Visit
                          </Text>
                          <IconSymbol
                            name="arrow.up.right.square"
                            size={14}
                            color={colors.primary}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {distributor?.paymentMethods && (
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: 11,
                          marginTop: 8,
                        }}
                      >
                        💳 {distributor.paymentMethods.join(" · ")}
                      </Text>
                    )}
                    {(() => {
                      const refreshColor = getLastRefreshedColor(
                        listing.lastChecked,
                      );
                      const colorMap = {
                        green: colors.success,
                        yellow: colors.warning,
                        red: colors.error,
                        gray: colors.muted,
                      };
                      return (
                        <Text
                          style={{
                            color: colorMap[refreshColor],
                            fontSize: 11,
                            marginTop: distributor?.paymentMethods ? 2 : 8,
                          }}
                        >
                          🕐 Updated {formatLastRefreshed(listing.lastChecked)}
                        </Text>
                      );
                    })()}
                    {/* Watch for Restock button on back-order cards */}
                    {listing.stockStatus === "back_order" && (
                      <TouchableOpacity
                        onPress={() => handleToggleStockWatch(listing)}
                        style={{
                          marginTop: 10,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          backgroundColor: stockWatches[listing.distributorId]
                            ? colors.warning + "22"
                            : colors.surface,
                          borderRadius: 12,
                          paddingVertical: 9,
                          borderWidth: 1,
                          borderColor: stockWatches[listing.distributorId]
                            ? colors.warning + "88"
                            : colors.border,
                        }}
                      >
                        <IconSymbol
                          name={
                            stockWatches[listing.distributorId]
                              ? "eye.fill"
                              : "eye.slash.fill"
                          }
                          size={15}
                          color={
                            stockWatches[listing.distributorId]
                              ? colors.warning
                              : colors.muted
                          }
                        />
                        <Text
                          style={{
                            color: stockWatches[listing.distributorId]
                              ? colors.warning
                              : colors.muted,
                            fontSize: 13,
                            fontWeight: "600",
                          }}
                        >
                          {stockWatches[listing.distributorId]
                            ? "Watching for Restock"
                            : "Watch for Restock"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>

      {/* Reminder Date Picker Modal */}
      <Modal
        visible={!!reminderListing}
        transparent
        animationType="slide"
        onRequestClose={() => setReminderListing(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 20,
                fontWeight: "700",
                marginBottom: 4,
              }}
            >
              Set Reminder 📅
            </Text>
            <Text
              style={{ color: colors.muted, fontSize: 14, marginBottom: 20 }}
            >
              Pick a date to be reminded to check{" "}
              <Text style={{ fontWeight: "600", color: colors.foreground }}>
                {reminderListing
                  ? (getDistributorById(reminderListing.distributorId)?.name ??
                    reminderListing.distributorId)
                  : ""}
              </Text>{" "}
              for {product?.name}.
            </Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <IconSymbol name="calendar" size={20} color={colors.primary} />
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 17,
                    fontWeight: "600",
                  }}
                >
                  {reminderDate.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={reminderDate}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                minimumDate={new Date()}
                onChange={(_, selected) => {
                  setShowDatePicker(Platform.OS === "ios");
                  if (selected) setReminderDate(selected);
                }}
              />
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setReminderListing(null);
                  setShowDatePicker(false);
                }}
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSetReminder}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  Set Reminder
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Price History Chart Modal */}
      <Modal
        visible={!!chartListing}
        transparent
        animationType="slide"
        onRequestClose={() => setChartListing(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "700",
                }}
              >
                Price History 📈
              </Text>
              <TouchableOpacity
                onPress={() => setChartListing(null)}
                style={{ padding: 4 }}
              >
                <IconSymbol
                  name="xmark.circle.fill"
                  size={24}
                  color={colors.muted}
                />
              </TouchableOpacity>
            </View>
            {chartListing && (
              <>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  {getDistributorById(chartListing.distributorId)?.name ??
                    chartListing.distributorId}{" "}
                  · {chartListing.currency}
                </Text>
                {chartListing.priceHistory &&
                chartListing.priceHistory.length >= 2 ? (
                  <PriceHistoryChart
                    data={chartListing.priceHistory}
                    currency={chartListing.currency}
                    width={chartWidth}
                    height={chartHeight}
                  />
                ) : (
                  <View
                    style={{
                      height: 120,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 14 }}>
                      Not enough data to display chart.
                    </Text>
                  </View>
                )}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 16,
                  }}
                >
                  <View>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      Current Price
                    </Text>
                    <Text
                      style={{
                        color: colors.primary,
                        fontWeight: "700",
                        fontSize: 16,
                      }}
                    >
                      {formatPrice(chartListing.price, chartListing.currency)}
                    </Text>
                  </View>
                  {chartListing.priceHistory &&
                    chartListing.priceHistory.length >= 2 &&
                    (() => {
                      const sorted = [...chartListing.priceHistory].sort(
                        (a, b) =>
                          new Date(a.date).getTime() -
                          new Date(b.date).getTime(),
                      );
                      const oldest = sorted[0].price;
                      const current = sorted[sorted.length - 1].price;
                      const pct = Math.abs(
                        Math.round(((current - oldest) / oldest) * 100),
                      );
                      const dir =
                        current < oldest
                          ? "down"
                          : current > oldest
                            ? "up"
                            : "flat";
                      return (
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>
                            vs. oldest recorded
                          </Text>
                          <Text
                            style={{
                              color:
                                dir === "down"
                                  ? colors.success
                                  : dir === "up"
                                    ? colors.error
                                    : colors.muted,
                              fontWeight: "700",
                              fontSize: 16,
                            }}
                          >
                            {dir === "down" ? "▼" : dir === "up" ? "▲" : "—"}{" "}
                            {pct}%
                          </Text>
                        </View>
                      );
                    })()}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Price Alert Modal */}
      <Modal visible={alertModalVisible} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 20,
                fontWeight: "700",
                marginBottom: 6,
              }}
            >
              Set Price Alert
            </Text>
            <Text
              style={{ color: colors.muted, fontSize: 14, marginBottom: 20 }}
            >
              Get notified when {product.name} drops below your target price.
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {Object.keys(EXCHANGE_RATES).map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setAlertCurrency(c)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor:
                      alertCurrency === c ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor:
                      alertCurrency === c ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: alertCurrency === c ? "#fff" : colors.foreground,
                      fontWeight: "600",
                    }}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={alertPrice}
              onChangeText={setAlertPrice}
              placeholder={`Target price in ${alertCurrency}`}
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
                color: colors.foreground,
                fontSize: 18,
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setAlertModalVisible(false)}
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSetAlert}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  Set Alert
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ─── Full-Screen Price History Chart ─────────────────────────────────────────
function PriceHistoryChart({
  data,
  currency,
  width,
  height,
}: {
  data: PricePoint[];
  currency: string;
  width: number;
  height: number;
}) {
  const colors = useColors();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const points = useMemo(() => {
    if (!data || data.length < 2) return null;
    const sorted = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const prices = sorted.map((p) => p.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1;
    const padL = 52,
      padR = 16,
      padT = 24,
      padB = 44;
    const usableW = width - padL - padR;
    const usableH = height - padT - padB;
    const coords = sorted.map((p, i) => {
      const x = padL + (i / (sorted.length - 1)) * usableW;
      const y = padT + (1 - (p.price - minP) / range) * usableH;
      return { x, y, price: p.price, date: p.date };
    });
    const polylineStr = coords.map((c) => `${c.x},${c.y}`).join(" ");
    const trend =
      coords[coords.length - 1].price >= coords[0].price ? "up" : "down";
    return {
      coords,
      polylineStr,
      trend,
      minP,
      maxP,
      padL,
      padR,
      padT,
      padB,
      usableH,
    };
  }, [data, width, height]);

  if (!points) return null;

  const lineColor = points.trend === "down" ? colors.success : colors.error;
  const { coords, polylineStr, minP, maxP, padL, padR, padT, padB, usableH } =
    points;
  const midP = (minP + maxP) / 2;
  const midY = padT + usableH / 2;
  const minY = padT + usableH;
  const maxY = padT;

  return (
    <Pressable
      onPress={(e) => {
        const x = e.nativeEvent.locationX;
        const idx = findNearestIndex(
          ((x - padL) / (width - padL - padR)) * 100,
          coords.length,
        );
        setSelectedIndex((prev) => (prev === idx ? null : idx));
      }}
    >
      <Svg width={width} height={height}>
        {[maxY, midY, minY].map((y, i) => (
          <Line
            key={i}
            x1={padL}
            y1={y}
            x2={width - 16}
            y2={y}
            stroke={colors.border}
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />
        ))}
        <SvgText
          x={padL - 6}
          y={maxY + 4}
          fontSize={10}
          fill={colors.muted}
          textAnchor="end"
        >
          {maxP.toFixed(0)}
        </SvgText>
        <SvgText
          x={padL - 6}
          y={midY + 4}
          fontSize={10}
          fill={colors.muted}
          textAnchor="end"
        >
          {midP.toFixed(0)}
        </SvgText>
        <SvgText
          x={padL - 6}
          y={minY + 4}
          fontSize={10}
          fill={colors.muted}
          textAnchor="end"
        >
          {minP.toFixed(0)}
        </SvgText>
        <Polyline
          points={polylineStr}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r={3} fill={lineColor} />
        ))}
        {[0, Math.floor((coords.length - 1) / 2), coords.length - 1].map(
          (idx) => {
            const c = coords[idx];
            const label = new Date(c.date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            });
            return (
              <SvgText
                key={idx}
                x={c.x}
                y={height - padB + 16}
                fontSize={10}
                fill={colors.muted}
                textAnchor="middle"
              >
                {label}
              </SvgText>
            );
          },
        )}
        {(() => {
          const minCoord = coords.reduce((a, b) => (b.price < a.price ? b : a));
          const maxCoord = coords.reduce((a, b) => (b.price > a.price ? b : a));
          return (
            <>
              <Rect
                x={minCoord.x - 22}
                y={minCoord.y - 16}
                width={44}
                height={14}
                rx={4}
                fill={colors.error + "33"}
              />
              <SvgText
                x={minCoord.x}
                y={minCoord.y - 5}
                fontSize={9}
                fill={colors.error}
                textAnchor="middle"
                fontWeight="700"
              >
                LOW {minP.toFixed(0)}
              </SvgText>
              <Rect
                x={maxCoord.x - 24}
                y={maxCoord.y + 4}
                width={48}
                height={14}
                rx={4}
                fill={colors.success + "33"}
              />
              <SvgText
                x={maxCoord.x}
                y={maxCoord.y + 14}
                fontSize={9}
                fill={colors.success}
                textAnchor="middle"
                fontWeight="700"
              >
                HIGH {maxP.toFixed(0)}
              </SvgText>
            </>
          );
        })()}
        {selectedIndex != null && coords[selectedIndex] && (
          <>
            <Line
              x1={coords[selectedIndex].x}
              y1={padT}
              x2={coords[selectedIndex].x}
              y2={padT + usableH}
              stroke={colors.muted}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            <Rect
              x={Math.min(coords[selectedIndex].x - 40, width - 90)}
              y={padT - 2}
              width={80}
              height={22}
              rx={6}
              fill={colors.surface}
              stroke={colors.border}
              strokeWidth={1}
            />
            <SvgText
              x={Math.min(coords[selectedIndex].x, width - 50)}
              y={padT + 8}
              fontSize={10}
              fill={colors.foreground}
              textAnchor="middle"
              fontWeight="700"
            >
              {formatPrice(coords[selectedIndex].price, currency)}
            </SvgText>
            <SvgText
              x={Math.min(coords[selectedIndex].x, width - 50)}
              y={padT + 18}
              fontSize={8}
              fill={colors.muted}
              textAnchor="middle"
            >
              {new Date(coords[selectedIndex].date).toLocaleDateString(
                undefined,
                {
                  month: "short",
                  day: "numeric",
                },
              )}
            </SvgText>
          </>
        )}
      </Svg>
    </Pressable>
  );
}
