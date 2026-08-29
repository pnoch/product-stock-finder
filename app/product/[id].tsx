import { Stack, useLocalSearchParams, router } from "expo-router";
import { ScrollView, Text, View, ActivityIndicator, TouchableOpacity, Share, Platform, Dimensions, Image } from "react-native";
import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { DetailHeader } from "@/components/product/detail-header";
import { DistributorRow } from "@/components/product/distributor-row";
import { AlertSection } from "@/components/product/alert-section";
import { ReminderSection } from "@/components/product/reminder-section";
import { useProductDetail } from "@/hooks/use-product-detail";
import { useColors } from "@/hooks/use-colors";
import { useLiveProduct } from "@/hooks/use-live-prices";
import { getWatchlist, getAlerts, getStockWatches, getSettings, addStockWatch, removeStockWatch, addBackOrderReminder, getBackOrderReminders } from "@/lib/storage";
import { formatPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { buildShareText, buildShareRows } from "@/lib/price-share";
import { PriceVsAvgCard } from "@/components/product/price-vs-avg-card";
import { computePriceVsAverage } from "@/lib/price-average";
import { captureAndShareImage } from "@/lib/share-image";
import { ProductShareCard } from "@/components/share/product-share-card";
import { findBestDeal } from "@/lib/best-deal";
import { fetchPriceInsight } from "@/lib/server-insights";
import { fetchProductImage } from "@/lib/server-images";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { schedulePriceAlert, scheduleBackOrderReminder, scheduleStockAlert, cancelNotification, requestNotificationPermissions } from "@/lib/notifications";
import { showAlert } from "@/lib/alert";
import { ProductInfoCard, ActionButtons, DistributorListingSection, PriceAlertModal, NotesCard, TargetTableCard, ReminderDatePickerModal, PriceChartModal } from "./_components";
import { PriceAlert, DistributorListing } from "@/lib/types";
import { getAllRegions, filterListingsByRegion } from "@/lib/region-filter";
import { suggestAlertPrices } from "@/lib/alert-suggestions";
import { SAMPLE_LISTINGS } from "@/lib/sample-data";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { product, listings, loaded, isRefreshingAny, lastUpdatedAt, refresh } = useLiveProduct(id);
  const [insight, setInsight] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCurrency, setAlertCurrency] = useState("USD");
  const [alertDistributorId, setAlertDistributorId] = useState<string | null>(null);
  const [alertDirection, setAlertDirection] = useState<"drop" | "rise">("drop");
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [shippingRegion, setShippingRegion] = useState("Asia-Pacific");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const regions = useMemo(() => getAllRegions(), []);
  const [reminderListing, setReminderListing] = useState<DistributorListing | null>(null);
  const [reminderDate, setReminderDate] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [stockWatches, setStockWatches] = useState<Record<string, boolean>>({});
  const [chartListing, setChartListing] = useState<DistributorListing | null>(null);
  const chartWidth = Dimensions.get("window").width - 48;
  const chartHeight = 200;

  const loadData = useCallback(async (signal?: { cancelled: boolean }) => {
    const [alertsData, insightData, imageData] = await Promise.all([
      getAlerts(),
      fetchPriceInsight(id).catch(() => null),
      fetchProductImage(id).catch(() => null),
    ]);
    if (signal?.cancelled) return;
    setAlerts(alertsData);
    if (insightData) setInsight(insightData.insight);
    if (imageData) setProductImage(imageData.imageUrl);
  }, [id]);

  useEffect(() => {
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
  const priceVsAvg = useMemo(() => computePriceVsAverage(listings, displayCurrency), [listings, displayCurrency]);
  const shareRows = useMemo(() => buildShareRows(sortedListings, displayCurrency), [sortedListings, displayCurrency]);
  const shareCardRef = useRef<any>(null);

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
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}><Text style={{ color: colors.primary }}>Go back</Text></TouchableOpacity>
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
        <DistributorListingSection sortedListings={sortedListings} visibleListings={visibleListings} bestInStockListing={null} product={product} insight={insight} regionFilter={regionFilter} regions={regions} shippingRegion={shippingRegion} bestDeal={bestDeal} stockWatches={stockWatches} id={id} displayCurrency={displayCurrency} onSetRegionFilter={setRegionFilter} onSetBestAlert={() => {}} onToggleStockWatch={() => {}} onOpenChart={setChartListing} onRemind={setReminderListing} />
        <AlertSection productId={product.id} />
        <ReminderSection productId={product.id} distributorId={visibleListings[0]?.distributorId ?? ""} productName={product.name} distributorName={visibleListings[0] ? getDistributorById(visibleListings[0].distributorId)?.name ?? "" : ""} />
      </ScrollView>
    </ScreenContainer>
  );
}
