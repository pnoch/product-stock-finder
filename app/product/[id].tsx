/* eslint-disable react-hooks/rules-of-hooks */
import { Stack, useLocalSearchParams, router } from "expo-router";
import { ScrollView, Text, View, TouchableOpacity, Platform, Animated, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { DetailHeader } from "@/components/product/detail-header";
import { AlertSection } from "@/components/product/alert-section";
import { ReminderSection } from "@/components/product/reminder-section";
import { useColors } from "@/hooks/use-colors";
import { useLiveProduct } from "@/hooks/use-live-prices";
import { getSettings, getStockWatches, addAlert, addStockWatch, removeStockWatch } from "@/lib/storage";
import { formatPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { PriceVsAvgCard } from "@/components/product/price-vs-avg-card";
import { computePriceVsAverage } from "@/lib/price-average";
import { findBestDeal } from "@/lib/best-deal";
import { fetchPriceInsight } from "@/lib/server-insights";
import { fetchProductImage } from "@/lib/server-images";
import { schedulePriceAlert, scheduleStockAlert, cancelNotification, requestNotificationPermissions } from "@/lib/notifications";
import { showAlert } from "@/lib/alert";
import { ProductInfoCard, DistributorListingSection } from "./_components";
import { PriceAlert, DistributorListing } from "@/lib/types";
import { getAllRegions, filterListingsByRegion } from "@/lib/region-filter";
import { SkeletonCard, SkeletonChart, SkeletonDetailHeader } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function ProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const colors = useColors();
  const { showToast } = useToast();
  if (!id) return null;
  const { product, listings, loaded, lastUpdatedAt, refresh } = useLiveProduct(id);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [shippingRegion, setShippingRegion] = useState("Asia-Pacific");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const regions = useMemo(() => getAllRegions(), []);
  const [stockWatches, setStockWatches] = useState<Record<string, boolean>>({});
  const scrollY = useRef(new Animated.Value(0)).current;
  const stickyOpacity = scrollY.interpolate({ inputRange: [80, 140], outputRange: [0, 1], extrapolate: "clamp" });
  const shareScale = useRef(new Animated.Value(1)).current;

  const loadData = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!id) return;
    setInsight(null);
    setInsightLoading(true);
    setProductImage(null);
    const [settingsData, stockWatchesData, insightData, imageData] = await Promise.all([
      getSettings(),
      getStockWatches(),
      fetchPriceInsight(id).catch(() => null),
      fetchProductImage(id).catch(() => null),
    ]);
    if (signal?.cancelled) return;
    if (settingsData?.displayCurrency) setDisplayCurrency(settingsData.displayCurrency);
    if (settingsData?.shippingRegion) setShippingRegion(settingsData.shippingRegion);
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
    loadData(signal);
    return () => { signal.cancelled = true; };
  }, [loadData]);

  const bestDeal = useMemo(() => findBestDeal(listings, shippingRegion, displayCurrency), [listings, shippingRegion, displayCurrency]);
  const sortedListings = [...listings].sort((a, b) => {
    const order: Record<string, number> = { in_stock: 0, back_order: 1, out_of_stock: 2, unknown: 3 };
    return (order[a.stockStatus] ?? 3) - (order[b.stockStatus] ?? 3);
  });
  const visibleListings = regionFilter === "all" ? sortedListings : filterListingsByRegion(sortedListings, regionFilter);
  const bestInStockListing = useMemo(() => {
    const inStock = visibleListings.filter((l) => l.stockStatus === "in_stock");
    if (inStock.length === 0) return null;
    return inStock.reduce((best, l) => (l.price < best.price ? l : best));
  }, [visibleListings]);
  const priceVsAvg = useMemo(() => computePriceVsAverage(listings, displayCurrency), [listings, displayCurrency]);

  const handleSetBestAlert = useCallback(async (listing: DistributorListing) => {
    if (!id) return;
    const granted = await requestNotificationPermissions();
    if (!granted) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Permission Denied", "Please enable notifications in your device settings to receive price alerts.");
      return;
    }
    try {
      await schedulePriceAlert(product?.name ?? "Product", listing.price, listing.currency, id);
      const alert: PriceAlert = {
        id: `alert-${id}-${listing.distributorId}-${Date.now()}`,
        productId: id,
        distributorId: listing.distributorId,
        targetPrice: listing.price,
        currency: listing.currency,
        createdAt: new Date().toISOString(),
        isActive: true,
      };
      await addAlert(alert);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`Alert created — you'll be notified below ${formatPrice(listing.price, listing.currency)}`, "success");
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
      const granted = await requestNotificationPermissions();
      if (!granted) {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert("Permission Denied", "Please enable notifications to watch for restocks.");
        return;
      }
      try {
        const distributor = getDistributorById(listing.distributorId);
        const notificationId = await scheduleStockAlert(product?.name ?? "Product", distributor?.name ?? listing.distributorId, listing.price, listing.currency, id);
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

  const handleShare = useCallback(async () => {
    if (!product) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.sequence([
        Animated.timing(shareScale, { toValue: 0.85, duration: 90, useNativeDriver: true }),
        Animated.spring(shareScale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 8 }),
      ]).start();
    }
    try {
      await Share.share({ message: `${product.name} — ${product.brand} ${product.modelNumber}`, title: product.name });
    } catch {
      showToast("Shared!", "success");
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [product, shareScale, showToast]);

  if (!loaded) {
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
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
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
            <IconSymbol name="magnifyingglass" size={30} color={colors.primary} />
          </View>
          <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700", marginTop: 16 }}>Product not found</Text>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20 }}>
            We couldn&apos;t find this product. It may have been removed or the link is invalid.
          </Text>
          <TouchableOpacity activeOpacity={0.85}
            onPress={() => refresh()}
            accessibilityLabel="Try again"
            accessibilityRole="button"
            style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12, marginTop: 20 }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} accessibilityLabel="Go back" accessibilityRole="button" style={{ marginTop: 12, padding: 8 }}>
            <Text style={{ color: colors.primary, fontWeight: "600" }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerShown: true,
          title: product.name,
          headerRight: () => (
            <Animated.View style={{ transform: [{ scale: shareScale }] }}>
              <TouchableOpacity activeOpacity={0.7} onPress={handleShare} style={{ padding: 6, marginRight: 4 }} accessibilityLabel="Share product" accessibilityRole="button">
                <IconSymbol name="square.and.arrow.up" size={20} color={colors.primary} />
              </TouchableOpacity>
            </Animated.View>
          ),
        }}
      />
      <Animated.View
        pointerEvents="none"
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
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: stickyOpacity,
        }}
      >
        <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14, flex: 1 }} numberOfLines={1}>
          {product.name}
        </Text>
        <TouchableOpacity activeOpacity={0.7} onPress={handleShare} style={{ padding: 4, marginLeft: 8 }}>
          <IconSymbol name="square.and.arrow.up" size={18} color={colors.primary} />
        </TouchableOpacity>
      </Animated.View>
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <DetailHeader product={product} bestDeal={bestDeal} />
        <ProductInfoCard product={product} listings={listings} visibleListings={visibleListings} lastUpdatedAt={lastUpdatedAt ? new Date(lastUpdatedAt).toISOString() : undefined} displayCurrency={displayCurrency} productImage={productImage} onEditDetails={() => {}} />
        {priceVsAvg && <PriceVsAvgCard data={priceVsAvg} />}
        <DistributorListingSection sortedListings={sortedListings} visibleListings={visibleListings} bestInStockListing={bestInStockListing} product={product} insight={insight} insightLoading={insightLoading} regionFilter={regionFilter} regions={regions} shippingRegion={shippingRegion} bestDeal={bestDeal} stockWatches={stockWatches} id={id} displayCurrency={displayCurrency} onSetRegionFilter={setRegionFilter} onSetBestAlert={handleSetBestAlert} onToggleStockWatch={handleToggleStockWatch} onOpenChart={() => router.push(`/compare/${id}`)} onRemind={() => {}} />
        <AlertSection productId={product.id} />
        <ReminderSection productId={product.id} distributorId={visibleListings[0]?.distributorId} productName={product.name} distributorName={visibleListings[0] ? getDistributorById(visibleListings[0].distributorId)?.name ?? "" : ""} />
      </Animated.ScrollView>
    </ScreenContainer>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
