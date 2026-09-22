import { Stack, useLocalSearchParams, router } from "expo-router";
import { goBackOrHome } from "@/lib/navigation";
import { ScrollView, Text, View, TouchableOpacity, Platform, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { DetailHeader } from "@/components/product/detail-header";
import { AlertSection } from "@/components/product/alert-section";
import { ReminderSection } from "@/components/product/reminder-section";
import { useColors } from "@/hooks/use-colors";
import { useLiveProduct } from "@/hooks/use-live-prices";
import { buildShareText } from "@/lib/price-share";
import { shareText as shareTextCrossPlatform } from "@/lib/share-text";
import * as Linking from "expo-linking";
import { captureAndShareImage } from "@/lib/share-image";
import { getSettings, getStockWatches, addAlert, addStockWatch, addBackOrderReminder, removeStockWatch } from "@/lib/storage";
import { formatPrice } from "@shared/currency";
import { convertPrice } from "@/lib/currency";
import { getDistributorById } from "@shared/distributors";
import { PriceVsAvgCard } from "@/components/product/price-vs-avg-card";
import { computePriceVsAverage } from "@/lib/price-average";
import { computeDealScore, dealBandLabel } from "@/lib/deal-score";
import { findBestDeal } from "@/lib/best-deal";
import { fetchPriceInsight } from "@/lib/server-insights";
import { fetchProductImage } from "@/lib/server-images";
import { schedulePriceAlert, scheduleStockWatchConfirmation, scheduleBackOrderReminder, cancelNotification, ensureNotificationPermission } from "@/lib/notifications";
import { showAlert } from "@/lib/alert";
import { ProductInfoCard, DistributorListingSection, ReminderDatePickerModal } from "./_components";
import { EditProductSheet } from "@/components/product/edit-product-sheet";
import { PriceAlert, DistributorListing } from "@/lib/types";
import { getAllRegions, filterListingsByRegion } from "@/lib/region-filter";
import { SkeletonCard, SkeletonChart, SkeletonDetailHeader } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { EmptyStateView } from "@/components/ui/empty-state-view";
import { LOG_ERROR } from "@shared/log";

export default function ProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const colors = useColors();
  const { showToast } = useToast();
  const { product, listings, loaded, lastUpdatedAt, refresh } = useLiveProduct(id ?? "");
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<string | null>(null);
  const [shippingRegion, setShippingRegion] = useState<string | null>(null);
  // Explicit flag: gating the skeleton on the settings *values* meant a failed
  // settings read (or a missing id) hung the screen forever.
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const regions = useMemo(() => getAllRegions(), []);
  const [stockWatches, setStockWatches] = useState<Record<string, boolean>>({});
  const scrollY = useRef(new Animated.Value(0)).current;
  const stickyOpacity = scrollY.interpolate({ inputRange: [80, 140], outputRange: [0, 1], extrapolate: "clamp" });
  const shareScale = useRef(new Animated.Value(1)).current;
  const [reminderListing, setReminderListing] = useState<DistributorListing | null>(null);
  const [reminderDate, setReminderDate] = useState(() => new Date(Date.now() + 7 * 86400000));
  const [editingProduct, setEditingProduct] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadData = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!id) {
      setSettingsLoaded(true);
      return;
    }
    setInsight(null);
    setInsightLoading(true);
    setProductImage(null);
    // Storage reads can reject; without a catch the setters below never run and
    // the screen hangs on the loading skeleton forever.
    const [settingsData, stockWatchesData, insightData, imageData] =
      await Promise.all([
        getSettings().catch(() => null),
        getStockWatches().catch(() => []),
        fetchPriceInsight(id).catch(() => null),
        fetchProductImage(id).catch(() => null),
      ]);
    if (signal?.cancelled) return;
    if (settingsData?.displayCurrency) setDisplayCurrency(settingsData.displayCurrency);
    if (settingsData?.shippingRegion) setShippingRegion(settingsData.shippingRegion);
    setSettingsLoaded(true);
    const watchMap: Record<string, boolean> = {};
    for (const w of stockWatchesData) {
      if (w.productId === id) watchMap[w.distributorId] = true;
    }
    setStockWatches(watchMap);
    if (insightData) setInsight(insightData.insight);
    setInsightLoading(false);
    if (imageData) setProductImage(imageData.imageUrl);
  }, [id]);

  useEffect(() => {
    setInsight(null);
    setInsightLoading(true);
    setProductImage(null);
    const signal = { cancelled: false };
    void loadData(signal);
    return () => { signal.cancelled = true; };
  }, [loadData]);

  const bestDeal = useMemo(() => {
    if (!shippingRegion || !displayCurrency) return null;
    return findBestDeal(listings, shippingRegion, displayCurrency);
  }, [listings, shippingRegion, displayCurrency]);
  const sortedListings = useMemo(
    () =>
      [...listings].sort((a, b) => {
        const order: Record<string, number> = { in_stock: 0, back_order: 1, out_of_stock: 2, unknown: 3 };
        return (order[a.stockStatus] ?? 3) - (order[b.stockStatus] ?? 3);
      }),
    [listings],
  );
  const visibleListings = useMemo(
    () => (regionFilter === "all" ? sortedListings : filterListingsByRegion(sortedListings, regionFilter)),
    [sortedListings, regionFilter],
  );
  const effectiveCurrency = displayCurrency ?? "USD";
  const effectiveShippingRegion = shippingRegion ?? "Asia-Pacific";
  const isSettingsLoaded = settingsLoaded;
  const bestInStockListing = useMemo(() => {
    const inStock = visibleListings.filter((l) => l.stockStatus === "in_stock");
    if (inStock.length === 0) return null;
    let best: DistributorListing | null = null;
    let bestConverted = Infinity;
    for (const l of inStock) {
      const converted = convertPrice(l.price, l.currency, effectiveCurrency);
      if (converted === null || !Number.isFinite(converted)) continue;
      if (converted < bestConverted) {
        bestConverted = converted;
        best = l;
      }
    }
    return best;
  }, [visibleListings, effectiveCurrency]);
  const priceVsAvg = useMemo(() => computePriceVsAverage(listings, effectiveCurrency), [listings, effectiveCurrency]);
  const dealScore = useMemo(() => computeDealScore(listings, effectiveCurrency), [listings, effectiveCurrency]);
  const reminderTarget = useMemo(
    () => bestInStockListing ?? sortedListings.find((l) => l.stockStatus !== "out_of_stock") ?? sortedListings[0] ?? null,
    [bestInStockListing, sortedListings],
  );

  const handleSetBestAlert = useCallback(async (listing: DistributorListing, targetPrice: number) => {
    if (!id) return;
    const granted = await ensureNotificationPermission();
    if (!granted) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Permission Denied", Platform.OS === "web" ? "Please allow notifications in your browser to receive price alerts." : "Please enable notifications in your device settings to receive price alerts.");
      return;
    }
    try {
      await schedulePriceAlert(product?.name ?? "Product", targetPrice, listing.currency, id);
      const alert: PriceAlert = {
        id: `alert-${id}-${listing.distributorId}-${Date.now()}`,
        productId: id,
        distributorId: listing.distributorId,
        targetPrice,
        currency: listing.currency,
        createdAt: new Date().toISOString(),
        isActive: true,
      };
      await addAlert(alert);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`Alert created — you'll be notified below ${formatPrice(targetPrice, listing.currency)}`, "success");
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Couldn't create alert", "We couldn't save your price alert. Please try again.");
    }
  }, [id, product, showToast]);

  const handleToggleStockWatch = useCallback(async (listing: DistributorListing) => {
    if (!id) return;
    const isWatched = stockWatches[listing.distributorId];
    if (isWatched) {
      try {
        const watches = await getStockWatches();
        const watch = watches.find((w) => w.productId === id && w.distributorId === listing.distributorId);
        if (watch) {
          if (watch.notificationId) await cancelNotification(watch.notificationId);
          await removeStockWatch(watch.id);
        }
        setStockWatches((prev) => ({ ...prev, [listing.distributorId]: false }));
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        showToast("Removed from restock watches", "info");
      } catch {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert("Couldn't remove watch", "We couldn't remove that restock watch. Please try again.");
      }
    } else {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert("Permission Denied", Platform.OS === "web" ? "Please allow notifications in your browser to watch for restocks." : "Please enable notifications to watch for restocks.");
        return;
      }
      try {
        const distributor = getDistributorById(listing.distributorId);
        const notificationId = await scheduleStockWatchConfirmation(product?.name ?? "Product", distributor?.name ?? listing.distributorId);
        await addStockWatch({
          id: `${id}-${listing.distributorId}`,
          productId: id,
          productName: product?.name ?? "",
          distributorId: listing.distributorId,
          distributorName: distributor?.name ?? "",
          reminderDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          reminderType: "back_in_stock",
          lastKnownStatus: listing.stockStatus,
          notificationId: notificationId ?? undefined,
        });
        setStockWatches((prev) => ({ ...prev, [listing.distributorId]: true }));
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(`Reminder set — you'll be notified when back in stock`, "success");
      } catch {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert("Couldn't set watch", "We couldn't save that restock watch. Please try again.");
      }
    }
  }, [id, product, stockWatches, showToast]);

  const handleSetReminder = useCallback(async () => {
    const listing = reminderListing;
    if (!id || !listing) return;
    const granted = await ensureNotificationPermission();
    if (!granted) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Permission Denied", Platform.OS === "web" ? "Please allow notifications in your browser to set reminders." : "Please enable notifications in your device settings to set reminders.");
      return;
    }
    try {
      const distributor = getDistributorById(listing.distributorId);
      const notifId = await scheduleBackOrderReminder(product?.name ?? "Product", distributor?.name ?? listing.distributorId, reminderDate, id);
      const { replacedNotificationId } = await addBackOrderReminder({
        id: `reminder-${id}-${listing.distributorId}-${Date.now()}`,
        productId: id,
        productName: product?.name ?? "",
        distributorId: listing.distributorId,
        distributorName: distributor?.name ?? "",
        reminderDate: reminderDate.toISOString(),
        notificationId: notifId ?? undefined,
        createdAt: new Date().toISOString(),
        reminderType: "date",
      });
      // Cancel the notification of the reminder this one replaced, or it
      // still fires on the old date and can no longer be cancelled.
      if (replacedNotificationId) {
        await cancelNotification(replacedNotificationId).catch(() => {});
      }
      setReminderListing(null);
      setShowDatePicker(false);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`Reminder set for ${reminderDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`, "success");
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Couldn't set reminder", "We couldn't save your reminder. Please try again.");
    }
  }, [id, product, reminderListing, reminderDate, showToast]);

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
    const shareText = buildShareText({
      product,
      listings: sortedListings,
      displayCurrency: effectiveCurrency,
      limit: 5,
    });
    const deepLink = Linking.createURL(`/product/${id}`, { scheme: "productstockfinder" });
    const message = `${shareText}\n\n${deepLink}`;
    try {
      const imageShared = await captureAndShareImage(shareRef as React.RefObject<View | null>, `product-${id}`);
      if (imageShared) {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
    } catch (e) {
      LOG_ERROR("[Product] image share failed, falling back to text", e);
    }
    const result = await shareTextCrossPlatform(message, product.name);
    if (result === "dismissed") return;
    if (result === "copied") {
      showToast("Copied to clipboard", "success");
    } else if (result === "failed") {
      showAlert("Share unavailable", "Sharing isn't supported in this browser.");
      return;
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [product, id, sortedListings, effectiveCurrency, shareScale, showToast]);

  if (!loaded || !isSettingsLoaded) {
    return (
      <ScreenContainer>
        <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
          <SkeletonDetailHeader />
          <View style={{ marginTop: 16 }}>
            <SkeletonCard />
            <SkeletonChart />
            <SkeletonCard />
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }
  if (!product) {
    return (
      <ScreenContainer>
        <EmptyStateView
          icon="magnifyingglass"
          title="Product not found"
          subtitle="We couldn't find this product. It may have been removed or the link is invalid."
          ctaLabel="Try Again"
          onCtaPress={() => refresh()}
          secondaryLabel="Go back"
          onSecondaryPress={() => goBackOrHome(router)}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* The screen renders its own sticky header below (with the back/share
          controls and safe-area padding). Enabling the native header too drew
          a second bar on top of it — an opaque white one in dark mode, with the
          title overlapping the status bar. Keep the root Stack's
          headerShown:false. */}
      <Stack.Screen options={{ headerShown: false }} />
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
          {product.name}
        </Text>
        <View pointerEvents="auto" style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setEditingProduct(true)}
            style={{ padding: 4, marginLeft: 8 }}
            accessibilityLabel="Edit product"
            accessibilityRole="button"
            hitSlop={10}
          >
            <IconSymbol name="pencil" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleShare}
            style={{ padding: 4, marginLeft: 8 }}
            accessibilityLabel="Share product"
            accessibilityRole="button"
            hitSlop={10}
          >
            <IconSymbol name="square.and.arrow.up" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </Animated.View>
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
      >
        <DetailHeader product={product} bestDeal={bestDeal} scrollY={scrollY} />
        <View ref={shareRef} collapsable={false}>
          <ProductInfoCard product={product} listings={listings} visibleListings={visibleListings} lastUpdatedAt={lastUpdatedAt ? new Date(lastUpdatedAt).toISOString() : undefined} displayCurrency={effectiveCurrency} productImage={productImage} />
          {dealScore != null && (
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
              <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}>
                Deal Score {dealScore.score} — {dealBandLabel(dealScore.band)}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Range {dealScore.factors.range}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Trend {dealScore.factors.trend}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Streak {dealScore.factors.streak}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Volatility {dealScore.factors.volatility}</Text>
              </View>
            </View>
          )}
          {priceVsAvg && <PriceVsAvgCard data={priceVsAvg} displayCurrency={effectiveCurrency} />}
          <DistributorListingSection sortedListings={sortedListings} visibleListings={visibleListings} bestInStockListing={bestInStockListing} product={product} insight={insight} insightLoading={insightLoading} regionFilter={regionFilter} regions={regions} shippingRegion={effectiveShippingRegion} bestDeal={bestDeal} stockWatches={stockWatches} id={id} displayCurrency={effectiveCurrency} onSetRegionFilter={setRegionFilter} onSetBestAlert={handleSetBestAlert} onToggleStockWatch={handleToggleStockWatch} onOpenChart={() => { console.log("[QA] push compare", id); router.push(`/compare/${id}`); }} onRemind={setReminderListing} />
        </View>
        <AlertSection productId={product.id} productName={product.name} displayCurrency={effectiveCurrency} />
        <ReminderSection productId={product.id} distributorId={reminderTarget?.distributorId} productName={product.name} distributorName={reminderTarget ? getDistributorById(reminderTarget.distributorId)?.name ?? "" : ""} onRemind={() => { if (reminderTarget) setReminderListing(reminderTarget); }} />
      </Animated.ScrollView>
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
      <EditProductSheet
        visible={editingProduct}
        onClose={() => setEditingProduct(false)}
        onSaved={() => void refresh()}
        product={product}
      />
    </ScreenContainer>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
