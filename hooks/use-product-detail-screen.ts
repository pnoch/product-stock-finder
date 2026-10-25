import { useCallback, useMemo, useRef, useState } from "react";
import { Animated, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/lib/settings-provider";
import { useLiveProduct } from "@/hooks/use-live-prices";
import { useProductDetailData } from "@/hooks/use-product-detail-data";
import { useProductAlerts } from "@/hooks/use-product-alerts";
import { useProductReminders } from "@/hooks/use-product-reminders";
import { useProductSharing } from "@/hooks/use-product-sharing";
import {
  addToWatchlist,
  updateProductAcquired,
  updateProductListings,
} from "@/lib/storage";
import { isAcquired } from "@/lib/acquired";
import {
  hasIncompleteDiscovery as productHasIncompleteDiscovery,
  rediscoverProduct,
} from "@/lib/manual-add";
import { discoverListings } from "@/lib/listing-discovery";
import { computeAvailability } from "@/lib/availability";
import { computePriceVsAverage } from "@/lib/price-average";
import { computeDealScore } from "@/lib/deal-score";
import { findBestDeal } from "@/lib/best-deal";
import { selectBestListing } from "@/lib/currency";
import { rankByLandedCost } from "@/lib/landed-cost";
import { resolveDestination, landedCostOptions } from "@/lib/destination";
import { showAlert } from "@/lib/alert";
import { getAllRegions, filterListingsByRegion } from "@/lib/region-filter";
import { useToast } from "@/components/ui/toast";
import { LOG_ERROR } from "@shared/log";

export function useProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id: rawId, distributor } = useLocalSearchParams<{
    id: string;
    distributor?: string;
  }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const highlightDistributorId = Array.isArray(distributor)
    ? distributor[0]
    : distributor;
  const { showToast } = useToast();
  const { settings, loading: settingsLoading, updateSetting } = useSettings();
  const { product, isTracked, listings, loaded, lastUpdatedAt, refresh, reloadSeed } =
    useLiveProduct(id ?? "", { allowCatalog: true });
  const [findingPrices, setFindingPrices] = useState(false);
  const [findingProgress, setFindingProgress] = useState<{ done: number; total: number } | null>(null);
  const productId = product?.id;
  const productModelNumber = product?.modelNumber;
  const completedDistributorIds = product?.discovery?.completedDistributorIds;
  const hasIncompleteDiscovery = useMemo(
    () => (product ? productHasIncompleteDiscovery(product) : false),
    [product],
  );

  const handleFindPrices = useCallback(async () => {
    if (!productModelNumber || findingPrices) return;
    setFindingPrices(true);
    setFindingProgress(null);
    try {
      const { discovered, timedOut } = await rediscoverProduct({
        storage: { updateProductListings },
        discover: discoverListings,
        productId: productId ?? "",
        modelNumber: productModelNumber,
        completedDistributorIds,
        onProgress: (done, total) => setFindingProgress({ done, total }),
        onSaved: reloadSeed,
      });
      await refresh();
      if (discovered > 0) {
        showAlert(
          "Prices found",
          `Found prices at ${discovered} distributor${discovered === 1 ? "" : "s"}.`,
        );
      } else if (timedOut) {
        showAlert(
          "Search timed out",
          "The distributor search took too long. Try again.",
        );
      } else {
        showAlert(
          "No prices found",
          "No distributor had this model in stock. Try again later.",
        );
      }
    } catch (e) {
      LOG_ERROR("[Product] price discovery failed", e);
      showAlert("Couldn't find prices", "Please try again later.");
    } finally {
      setFindingPrices(false);
      setFindingProgress(null);
    }
  }, [productId, productModelNumber, completedDistributorIds, findingPrices, refresh, reloadSeed]);

  const displayCurrency = settings.displayCurrency;
  const shippingRegion = settings.shippingRegion;
  const shipToCountry = settings.shipToCountry ?? null;
  const taxExempt = settings.taxExempt === true;
  const includeImportEstimate = settings.includeImportEstimate === true;
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const regions = useMemo(() => getAllRegions(), []);
  const scrollY = useState(() => new Animated.Value(0))[0];
  const stickyOpacity = scrollY.interpolate({
    inputRange: [80, 140],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const shareScale = useState(() => new Animated.Value(1))[0];
  const [editingProduct, setEditingProduct] = useState(false);
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);

  const destination = useMemo(
    () =>
      resolveDestination(
        shipToCountry ?? undefined,
        displayCurrency ?? undefined,
      ),
    [shipToCountry, displayCurrency],
  );
  const landedOptions = useMemo(
    () => landedCostOptions(taxExempt, includeImportEstimate, product?.category),
    [taxExempt, includeImportEstimate, product?.category],
  );
  const bestDeal = useMemo(() => {
    if (destination) {
      const ranked = rankByLandedCost(listings, destination, landedOptions);
      const top = ranked[0];
      if (!top) return null;
      return {
        distributorId: top.distributorId,
        price: top.price,
        tax: top.storeTax,
        shipping: top.shipping,
        importEstimate: top.importEstimate,
        total: top.total,
        currency: top.currency,
      };
    }
    if (!shippingRegion || !displayCurrency) return null;
    return findBestDeal(listings, shippingRegion, displayCurrency);
  }, [listings, destination, landedOptions, shippingRegion, displayCurrency]);
  const sortedListings = useMemo(
    () =>
      [...listings].sort((a, b) => {
        const order: Record<string, number> = {
          in_stock: 0,
          back_order: 1,
          out_of_stock: 2,
          unknown: 3,
        };
        return (order[a.stockStatus] ?? 3) - (order[b.stockStatus] ?? 3);
      }),
    [listings],
  );
  const visibleListings = useMemo(
    () =>
      regionFilter === "all"
        ? sortedListings
        : filterListingsByRegion(sortedListings, regionFilter),
    [sortedListings, regionFilter],
  );
  const effectiveCurrency = displayCurrency ?? "USD";
  const effectiveShippingRegion = shippingRegion ?? "Asia-Pacific";
  const isSettingsLoaded = !settingsLoading;
  const bestInStockListing = useMemo(
    () =>
      selectBestListing(visibleListings, {
        currency: effectiveCurrency,
        stock: "in_stock",
      })?.listing ?? null,
    [visibleListings, effectiveCurrency],
  );
  const isOutOfStock = useMemo(
    () =>
      selectBestListing(listings, {
        currency: effectiveCurrency,
        stock: "in_stock",
      }) == null,
    [listings, effectiveCurrency],
  );

  const detailData = useProductDetailData({
    id: id ?? "",
    product,
    isOutOfStock,
    effectiveCurrency,
  });

  const alertState = useProductAlerts({
    id: id ?? "",
    product,
    listings,
    visibleListings,
    displayCurrency: effectiveCurrency,
    setAlerts: detailData.setAlerts,
    showToast,
  });

  const shareRef = useRef<React.ComponentRef<typeof View>>(null);

  const reminders = useProductReminders({
    id: id ?? "",
    product,
    listings,
    stockWatches: detailData.stockWatches,
    setStockWatches: detailData.setStockWatches,
    showToast,
  });

  const { handleShare, handleExportCsv } = useProductSharing({
    id: id ?? "",
    product,
    listings,
    sortedListings,
    displayCurrency: effectiveCurrency,
    shareRef,
    shareScale,
    showToast,
  });

  const handleToggleAcquired = useCallback(async () => {
    if (!product) return;
    try {
      await updateProductAcquired(
        product.id,
        isAcquired(product) ? null : new Date().toISOString(),
      );
      await refresh();
    } catch {
      showAlert("Couldn't update", "Please try again.");
    }
  }, [product, refresh]);

  const handleAddToWatchlist = useCallback(async () => {
    if (!product || addingToWatchlist) return;
    setAddingToWatchlist(true);
    try {
      await addToWatchlist({
        ...product,
        addedAt: new Date().toISOString(),
        isWatched: true,
        listings: product.listings ?? [],
        tags: product.tags ?? [],
      });
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Added to watchlist", "success");
      await refresh();
    } catch {
      showAlert("Couldn't add", "Please try again.");
    } finally {
      setAddingToWatchlist(false);
    }
  }, [product, addingToWatchlist, refresh, showToast]);

  const priceVsAvg = useMemo(
    () => computePriceVsAverage(listings, effectiveCurrency),
    [listings, effectiveCurrency],
  );
  const availability = useMemo(() => computeAvailability(listings), [listings]);
  const dealScore = useMemo(
    () => computeDealScore(listings, effectiveCurrency),
    [listings, effectiveCurrency],
  );
  const reminderTarget = useMemo(
    () =>
      bestInStockListing ??
      sortedListings.find((l) => l.stockStatus !== "out_of_stock") ??
      sortedListings[0] ??
      null,
    [bestInStockListing, sortedListings],
  );

  const handleSelectCountry = useCallback(
    (code: string) => {
      void updateSetting("shipToCountry", code);
    },
    [updateSetting],
  );

  const handleToggleTaxExempt = useCallback(
    (value: boolean) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void updateSetting("taxExempt", value);
    },
    [updateSetting],
  );

  const handleToggleImportEstimate = useCallback(
    (value: boolean) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void updateSetting("includeImportEstimate", value);
    },
    [updateSetting],
  );

  return {
    insets,
    id,
    highlightDistributorId,
    product,
    isTracked,
    listings,
    loaded,
    lastUpdatedAt,
    refresh,
    findingPrices,
    findingProgress,
    hasIncompleteDiscovery,
    handleFindPrices,
    displayCurrency,
    effectiveCurrency,
    effectiveShippingRegion,
    shippingRegion,
    shipToCountry,
    taxExempt,
    includeImportEstimate,
    regionFilter,
    setRegionFilter,
    regions,
    scrollY,
    stickyOpacity,
    shareScale,
    shareRef,
    editingProduct,
    setEditingProduct,
    addingToWatchlist,
    destination,
    landedOptions,
    bestDeal,
    sortedListings,
    visibleListings,
    isSettingsLoaded,
    bestInStockListing,
    isOutOfStock,
    detailData,
    alertState,
    reminders,
    handleShare,
    handleExportCsv,
    handleToggleAcquired,
    handleAddToWatchlist,
    priceVsAvg,
    availability,
    dealScore,
    reminderTarget,
    handleSelectCountry,
    handleToggleTaxExempt,
    handleToggleImportEstimate,
  };
}
