import { useCallback, useEffect, useState, useMemo } from "react";
import * as Clipboard from "expo-clipboard";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Platform,
  Dimensions,
  Image,
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
import { DistributorListing, PriceAlert } from "@/lib/types";
import { formatPrice, getBestPrice } from "@/lib/currency";
import { suggestAlertPrices } from "@/lib/alert-suggestions";
import { getDistributorById } from "@/lib/distributors";
import { buildShareText } from "@/lib/price-share";
import { getAllRegions, filterListingsByRegion } from "@/lib/region-filter";
import { findBestDeal } from "@/lib/best-deal";
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
import { SAMPLE_LISTINGS } from "@/lib/sample-data";
import {
  ProductInfoCard,
  ActionButtons,
  DistributorListingSection,
  PriceAlertModal,
  ReminderDatePickerModal,
  PriceChartModal,
} from "./_components";

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

  const [reminderListing, setReminderListing] =
    useState<DistributorListing | null>(null);
  const [reminderDate, setReminderDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [stockWatches, setStockWatches] = useState<Record<string, boolean>>({});

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

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function pollStockWatches() {
        const settings = await getSettings();
        if (active) {
          setDisplayCurrency(settings.displayCurrency ?? "USD");
          setAlertCurrency(settings.displayCurrency ?? "USD");
          setShippingRegion(settings.shippingRegion ?? "Asia-Pacific");
        }

        const watches = await getStockWatches();
        const productWatches = watches.filter((w) => w.productId === id);
        const watchMap: Record<string, boolean> = {};
        for (const w of productWatches) watchMap[w.distributorId] = true;
        if (active) setStockWatches(watchMap);

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
          "Watching for Restock",
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
      l.price < best.price ? l : best,
    );
  })();

  const bestDeal = useMemo(
    () => findBestDeal(visibleListings, shippingRegion, displayCurrency),
    [visibleListings, shippingRegion, displayCurrency],
  );

  const alertSuggestions = useMemo(
    () => suggestAlertPrices(product?.listings ?? [], alertCurrency),
    [product, alertCurrency],
  );

  const handleShare = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: buildShareText({
          productName: product?.name ?? "Product",
          modelNumber: product?.modelNumber ?? "",
          listings: sortedListings,
          displayCurrency,
        }),
        title: product?.name ?? "Product",
      });
    } catch {
      // User cancelled share
    }
  }, [product, sortedListings, displayCurrency]);

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
      "Reminder Set!",
      `You'll be reminded to check ${distributorName} for ${product.name} on ${reminderDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.`,
    );
  }, [reminderListing, reminderDate, product]);

  const handleSetBestAlert = useCallback(
    async (listing: DistributorListing) => {
      if (!product) return;
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const suggestedPrice =
        Math.round(listing.price * 0.95 * 100) / 100;
      const newAlert: PriceAlert = {
        id: `alert-${Date.now()}`,
        productId: id,
        targetPrice: suggestedPrice,
        currency: listing.currency,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      await addAlert(newAlert);
      await requestNotificationPermissions();
      await schedulePriceAlert(
        product.name,
        suggestedPrice,
        listing.currency,
      );
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(
        "Alert Set",
        `You'll be notified when the price drops below ${formatPrice(suggestedPrice, listing.currency)} (5% off current).`,
      );
    },
    [id, product],
  );

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

        <ProductInfoCard
          product={product}
          listings={listings}
          visibleListings={visibleListings}
          lastUpdatedAt={
            lastUpdatedAt
              ? new Date(lastUpdatedAt).toISOString()
              : undefined
          }
          displayCurrency={displayCurrency}
          productImage={productImage}
        />

        <ActionButtons
          onSetAlert={() => setAlertModalVisible(true)}
          isRefreshingAny={isRefreshingAny}
          onRefresh={refresh}
          onShare={handleShare}
          onTestStockNotification={handleTestStockNotification}
          onCopyLink={handleCopyLink}
          onCompare={() => router.push(`/compare/${id}`)}
        />

        <DistributorListingSection
          sortedListings={sortedListings}
          visibleListings={visibleListings}
          bestInStockListing={bestInStockListing}
          product={product}
          insight={insight}
          regionFilter={regionFilter}
          regions={regions}
          shippingRegion={shippingRegion}
          bestDeal={bestDeal}
          stockWatches={stockWatches}
          id={id}
          onSetRegionFilter={setRegionFilter}
          onSetBestAlert={handleSetBestAlert}
          onToggleStockWatch={handleToggleStockWatch}
          onOpenChart={setChartListing}
        />
      </ScrollView>

      <PriceAlertModal
        visible={alertModalVisible}
        onClose={() => setAlertModalVisible(false)}
        onSetAlert={handleSetAlert}
        alertPrice={alertPrice}
        setAlertPrice={setAlertPrice}
        alertCurrency={alertCurrency}
        setAlertCurrency={setAlertCurrency}
        productName={product.name}
        suggestions={alertSuggestions}
      />

      <ReminderDatePickerModal
        visible={!!reminderListing}
        onClose={() => {
          setReminderListing(null);
          setShowDatePicker(false);
        }}
        reminderListing={reminderListing}
        reminderDate={reminderDate}
        showDatePicker={showDatePicker}
        setShowDatePicker={setShowDatePicker}
        setReminderDate={setReminderDate}
        onSetReminder={handleSetReminder}
        productName={product.name}
      />

      <PriceChartModal
        visible={!!chartListing}
        chartListing={chartListing}
        onClose={() => setChartListing(null)}
        chartWidth={chartWidth}
        chartHeight={chartHeight}
      />
    </ScreenContainer>
  );
}
