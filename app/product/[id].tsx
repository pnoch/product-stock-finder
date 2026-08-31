/* eslint-disable react-hooks/rules-of-hooks */
import { Stack, useLocalSearchParams, router } from "expo-router";
import { ScrollView, Text, View, ActivityIndicator, TouchableOpacity } from "react-native";
import { useCallback, useEffect, useState, useMemo } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { DetailHeader } from "@/components/product/detail-header";
import { AlertSection } from "@/components/product/alert-section";
import { ReminderSection } from "@/components/product/reminder-section";
import { useColors } from "@/hooks/use-colors";
import { useLiveProduct } from "@/hooks/use-live-prices";
import { getSettings, getStockWatches, addAlert, addStockWatch, removeStockWatch } from "@/lib/storage";
import { CURRENCY_SYMBOLS } from "@/lib/currency";
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

export default function ProductDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const colors = useColors();
  if (!id) return null;
  const { product, listings, loaded, lastUpdatedAt } = useLiveProduct(id);
  const [insight, setInsight] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [shippingRegion, setShippingRegion] = useState("Asia-Pacific");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const regions = useMemo(() => getAllRegions(), []);
  const [stockWatches, setStockWatches] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!id) return;
    setInsight(null);
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
    if (imageData) setProductImage(imageData.imageUrl);
  }, [id]);

  useEffect(() => {
    setInsight(null);
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
      showAlert("Permission Denied", "Please enable notifications in your device settings to receive price alerts.");
      return;
    }
    const sym = CURRENCY_SYMBOLS[listing.currency] ?? listing.currency;
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
    showAlert("Alert Set!", `You'll be notified when ${product?.name} drops below ${sym}${listing.price.toFixed(2)} at ${getDistributorById(listing.distributorId)?.name ?? listing.distributorId}.`);
  }, [id, product]);

  const handleToggleStockWatch = useCallback(async (listing: DistributorListing) => {
    if (!id) return;
    const isWatched = stockWatches[listing.distributorId];
    if (isWatched) {
      const watches = await getStockWatches();
      const watch = watches.find((w) => w.productId === id && w.distributorId === listing.distributorId);
      if (watch) {
        if (watch.notificationId) await cancelNotification(watch.notificationId);
        await removeStockWatch(watch.id);
      }
      setStockWatches((prev) => ({ ...prev, [listing.distributorId]: false }));
    } else {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        showAlert("Permission Denied", "Please enable notifications to watch for restocks.");
        return;
      }
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
      showAlert("Watching!", `You'll be notified when ${product?.name} is back in stock at ${distributor?.name ?? listing.distributorId}.`);
    }
  }, [id, product, stockWatches]);

  if (!loaded) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }
  if (!product) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.foreground, fontSize: 16 }}>Product not found</Text>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" accessibilityRole="button" style={{ marginTop: 16 }}><Text style={{ color: colors.primary }}>Go back</Text></TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: product.name }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <DetailHeader product={product} bestDeal={bestDeal} />
        <ProductInfoCard product={product} listings={listings} visibleListings={visibleListings} lastUpdatedAt={lastUpdatedAt ? new Date(lastUpdatedAt).toISOString() : undefined} displayCurrency={displayCurrency} productImage={productImage} onEditDetails={() => {}} />
        {priceVsAvg && <PriceVsAvgCard data={priceVsAvg} />}
        <DistributorListingSection sortedListings={sortedListings} visibleListings={visibleListings} bestInStockListing={bestInStockListing} product={product} insight={insight} regionFilter={regionFilter} regions={regions} shippingRegion={shippingRegion} bestDeal={bestDeal} stockWatches={stockWatches} id={id} displayCurrency={displayCurrency} onSetRegionFilter={setRegionFilter} onSetBestAlert={handleSetBestAlert} onToggleStockWatch={handleToggleStockWatch} onOpenChart={() => router.push(`/compare/${id}`)} onRemind={() => {}} />
        <AlertSection productId={product.id} />
        <ReminderSection productId={product.id} distributorId={visibleListings[0]?.distributorId} productName={product.name} distributorName={visibleListings[0] ? getDistributorById(visibleListings[0].distributorId)?.name ?? "" : ""} />
      </ScrollView>
    </ScreenContainer>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
