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
import { getSettings, getStockWatches, getAlerts, addAlert, addStockWatch, addBackOrderReminder, removeStockWatch, updateProductListings, updateSettings, getWatchlist, updateProductAcquired } from "@/lib/storage";
import { isAcquired } from "@/lib/acquired";
import { pickAlternatives, localAlternatives, type Alternative } from "@/lib/alternatives";
import { fetchAvailable } from "@/lib/server-catalog";
import { isServerConfigured } from "@/constants/oauth";
import { rediscoverProduct } from "@/lib/manual-add";
import { discoverListings } from "@/lib/listing-discovery";
import { formatPrice } from "@shared/currency";
import { getDistributorById } from "@shared/distributors";
import { PriceVsAvgCard } from "@/components/product/price-vs-avg-card";
import { AvailabilityCard } from "@/components/product/availability-card";
import { computeAvailability } from "@/lib/availability";
import { computePriceVsAverage } from "@/lib/price-average";
import { computeDealScore, dealBandLabel } from "@/lib/deal-score";
import { findBestDeal, findCheapestInStockListing } from "@/lib/best-deal";
import { rankByLandedCost } from "@/lib/landed-cost";
import { resolveDestination, landedCostOptions } from "@/lib/destination";
import { suggestAlertPrices } from "@/lib/alert-suggestions";
import { toggleAnyWatchRecord } from "@/lib/any-watch";
import { fetchPriceInsight } from "@/lib/server-insights";
import { fetchProductImage } from "@/lib/server-images";
import { schedulePriceAlert, scheduleStockWatchConfirmation, scheduleBackOrderReminder, cancelNotification, ensureNotificationPermission } from "@/lib/notifications";
import { showAlert } from "@/lib/alert";
import { ProductInfoCard, DistributorListingSection, ReminderDatePickerModal, NotesCard, TargetTableCard, PriceAlertModal } from "./_components";
import { EditProductSheet } from "@/components/product/edit-product-sheet";
import { AlternativesSection } from "@/components/product/alternatives-section";
import { PriceAlert, DistributorListing } from "@/lib/types";
import { getAllRegions, filterListingsByRegion } from "@/lib/region-filter";
import { SkeletonCard, SkeletonChart, SkeletonDetailHeader } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { EmptyStateView } from "@/components/ui/empty-state-view";
import { productHistoryToCsv, hasExportablePriceData } from "@/lib/csv";
import { exportCsvFile } from "@/lib/csv-export";
import { LOG_ERROR } from "@shared/log";

export default function ProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id: rawId, distributor } = useLocalSearchParams<{
    id: string;
    distributor?: string;
  }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const highlightDistributorId = Array.isArray(distributor)
    ? distributor[0]
    : distributor;
  const colors = useColors();
  const { showToast } = useToast();
  const { product, listings, loaded, lastUpdatedAt, refresh } = useLiveProduct(id ?? "");
  const [findingPrices, setFindingPrices] = useState(false);
  const handleFindPrices = useCallback(async () => {
    if (!product?.modelNumber || findingPrices) return;
    setFindingPrices(true);
    try {
      const { discovered, timedOut } = await rediscoverProduct({
        storage: { updateProductListings },
        discover: discoverListings,
        productId: product.id,
        modelNumber: product.modelNumber,
      });
      await refresh();
      if (discovered > 0) {
        showAlert(
          "Prices found",
          `Found prices at ${discovered} distributor${discovered === 1 ? "" : "s"}.`,
        );
      } else if (timedOut) {
        showAlert("Search timed out", "The distributor search took too long. Try again.");
      } else {
        showAlert("No prices found", "No distributor had this model in stock. Try again later.");
      }
    } catch (e) {
      LOG_ERROR("[Product] price discovery failed", e);
      showAlert("Couldn't find prices", "Please try again later.");
    } finally {
      setFindingPrices(false);
    }
  }, [product?.id, product?.modelNumber, findingPrices, refresh]);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<string | null>(null);
  const [shippingRegion, setShippingRegion] = useState<string | null>(null);
  const [shipToCountry, setShipToCountry] = useState<string | null>(null);
  const [taxExempt, setTaxExempt] = useState(false);
  const [includeImportEstimate, setIncludeImportEstimate] = useState(false);
  // Explicit flag: gating the skeleton on the settings *values* meant a failed
  // settings read (or a missing id) hung the screen forever.
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const regions = useMemo(() => getAllRegions(), []);
  const [stockWatches, setStockWatches] = useState<Record<string, boolean>>({});
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const scrollY = useRef(new Animated.Value(0)).current;
  const stickyOpacity = scrollY.interpolate({ inputRange: [80, 140], outputRange: [0, 1], extrapolate: "clamp" });
  const shareScale = useRef(new Animated.Value(1)).current;
  const [reminderListing, setReminderListing] = useState<DistributorListing | null>(null);
  const [reminderDate, setReminderDate] = useState(() => new Date(Date.now() + 7 * 86400000));
  const [editingProduct, setEditingProduct] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Scoped-alert flow for the Distributor Targets table: the "+" per row opens
  // the shared PriceAlertModal pre-scoped to that distributor.
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertDistributorId, setAlertDistributorId] = useState<string | null>(null);
  const [alertDirection, setAlertDirection] = useState<"drop" | "rise">("drop");
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCurrency, setAlertCurrency] = useState("USD");
  // Guards against a double-tap / Enter+button double-submit creating two alerts.
  const [creatingAlert, setCreatingAlert] = useState(false);
  // Guards the restock-watch toggle: a double-tap scheduled two confirmation
  // notifications, and the first's id was orphaned (replaced) so it could never
  // be cancelled.
  const [togglingWatch, setTogglingWatch] = useState(false);

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
    const [settingsData, stockWatchesData, insightData, imageData, alertsData] =
      await Promise.all([
        getSettings().catch(() => null),
        getStockWatches().catch(() => []),
        fetchPriceInsight(id).catch(() => null),
        fetchProductImage(id).catch(() => null),
        getAlerts().catch(() => []),
      ]);
    if (signal?.cancelled) return;
    if (settingsData?.displayCurrency) setDisplayCurrency(settingsData.displayCurrency);
    if (settingsData?.shippingRegion) setShippingRegion(settingsData.shippingRegion);
    setShipToCountry(settingsData?.shipToCountry ?? null);
    setTaxExempt(settingsData?.taxExempt === true);
    setIncludeImportEstimate(settingsData?.includeImportEstimate === true);
    if (settingsData?.displayCurrency) setAlertCurrency(settingsData.displayCurrency);
    setSettingsLoaded(true);
    setAlerts(alertsData);
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

  const destination = useMemo(
    () =>
      resolveDestination(shipToCountry ?? undefined, displayCurrency ?? undefined),
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
  const bestInStockListing = useMemo(
    () =>
      findCheapestInStockListing(
        visibleListings.filter((l) => l.stockStatus === "in_stock"),
        effectiveCurrency,
      ),
    [visibleListings, effectiveCurrency],
  );
  // `bestInStockListing` is a new object identity every render (listings
  // recompute from useQueries), so depend on this stable boolean instead — an
  // object dep would re-run the alternatives effect every render. Computed from
  // the UNFILTERED listings: "out of stock everywhere", not just in the region
  // filter, is the dead end that warrants alternatives.
  const isOutOfStock = useMemo(
    () =>
      findCheapestInStockListing(
        listings.filter((l) => l.stockStatus === "in_stock"),
        effectiveCurrency,
      ) == null,
    [listings, effectiveCurrency],
  );
  useEffect(() => {
    if (!product?.category || !isOutOfStock) {
      // Bail out when already empty: a fresh `[]` would be a new reference and
      // re-trigger this effect into an infinite loop.
      setAlternatives((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    let active = true;
    (async () => {
      try {
        const next = isServerConfigured()
          ? pickAlternatives({
              product: { id, category: product.category },
              available: await fetchAvailable({
                category: product.category,
                currency: effectiveCurrency,
              }),
            })
          : localAlternatives(
              { id, category: product.category },
              await getWatchlist(),
              effectiveCurrency,
            );
        if (active) setAlternatives(next);
      } catch {
        if (active) setAlternatives([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [product?.category, isOutOfStock, effectiveCurrency, id]);
  const priceVsAvg = useMemo(() => computePriceVsAverage(listings, effectiveCurrency), [listings, effectiveCurrency]);
  const availability = useMemo(() => computeAvailability(listings), [listings]);
  const dealScore = useMemo(() => computeDealScore(listings, effectiveCurrency), [listings, effectiveCurrency]);
  const reminderTarget = useMemo(
    () => bestInStockListing ?? sortedListings.find((l) => l.stockStatus !== "out_of_stock") ?? sortedListings[0] ?? null,
    [bestInStockListing, sortedListings],
  );

  const handleSetBestAlert = useCallback(async (listing: DistributorListing, targetPrice: number) => {
    if (!id || creatingAlert) return;
    // Claim the guard before the await: ensureNotificationPermission resolves
    // asynchronously, so a double-tap could start two alert creations (the flag
    // used to be set only after the permission round-trip). The finally below
    // clears it on every path.
    setCreatingAlert(true);
    try {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert("Permission Denied", Platform.OS === "web" ? "Please allow notifications in your browser to receive price alerts." : "Please enable notifications in your device settings to receive price alerts.");
        return;
      }
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
      // Keep the parent's alerts state in sync so the Distributor Targets table
      // reflects the new target immediately (it reads this state).
      setAlerts((prev) => [...prev, alert]);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`Alert created — you'll be notified below ${formatPrice(targetPrice, listing.currency)}`, "success");
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Couldn't create alert", "We couldn't save your price alert. Please try again.");
    } finally {
      setCreatingAlert(false);
    }
  }, [id, product, showToast, creatingAlert]);

  const handleSetTarget = useCallback((distributorId: string) => {
    setAlertDistributorId(distributorId);
    setAlertDirection("drop");
    setAlertPrice("");
    setAlertModalVisible(true);
  }, []);

  const handleSelectCountry = useCallback((code: string) => {
    setShipToCountry(code);
    void updateSettings({ shipToCountry: code });
  }, []);

  const handleToggleTaxExempt = useCallback((value: boolean) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTaxExempt(value);
    void updateSettings({ taxExempt: value });
  }, []);

  const handleToggleImportEstimate = useCallback((value: boolean) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIncludeImportEstimate(value);
    void updateSettings({ includeImportEstimate: value });
  }, []);

  const handleSetAlert = useCallback(async () => {
    if (!id || creatingAlert) return;
    const price = parseFloat(alertPrice);
    if (!Number.isFinite(price) || price <= 0) {
      showAlert("Invalid Price", "Please enter a valid target price.");
      return;
    }
    setCreatingAlert(true);
    try {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert("Permission Denied", Platform.OS === "web" ? "Please allow notifications in your browser to receive price alerts." : "Please enable notifications in your device settings to receive price alerts.");
        return;
      }
      await schedulePriceAlert(product?.name ?? "Product", price, alertCurrency, id);
      const newAlert: PriceAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: id,
        targetPrice: price,
        currency: alertCurrency,
        distributorId: alertDistributorId ?? undefined,
        direction: alertDirection,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      await addAlert(newAlert);
      setAlerts((prev) => [...prev, newAlert]);
      setAlertModalVisible(false);
      setAlertPrice("");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(
        `Alert set — ${alertDistributorId ? `${getDistributorById(alertDistributorId)?.name ?? "that distributor"}'s price` : "the price"} ${alertDirection === "rise" ? "rises above" : "drops below"} ${formatPrice(price, alertCurrency)}`,
        "success",
      );
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Couldn't create alert", "We couldn't save your price alert. Please try again.");
    } finally {
      setCreatingAlert(false);
    }
  }, [id, product, alertPrice, alertCurrency, alertDistributorId, alertDirection, showToast, creatingAlert]);

  const alertSuggestions = useMemo(
    // Use the live listings, not `product.listings` (which the hook only seeds
    // from storage on load and never re-syncs after a refresh), so the suggested
    // target prices match the chart/sparkline on screen.
    () => suggestAlertPrices(listings ?? [], alertCurrency),
    [listings, alertCurrency],
  );

  const alertDistributors = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; countryCode: string }>();
    for (const listing of visibleListings) {
      if (seen.has(listing.distributorId)) continue;
      const dist = getDistributorById(listing.distributorId);
      seen.set(listing.distributorId, {
        id: listing.distributorId,
        name: dist?.name ?? listing.distributorId,
        countryCode: dist?.countryCode ?? "",
      });
    }
    return [...seen.values()];
  }, [visibleListings]);

  // Always creates the any-watch (idempotent id `${id}-any`); never removes.
  // Shared by the toggle's create branch and the scope dialog's "Any
  // distributor", which must not toggle off an existing watch.
  const createAnyWatchRecord = useCallback(async () => {
    const granted = await ensureNotificationPermission();
    if (!granted) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert(
        "Permission Denied",
        Platform.OS === "web"
          ? "Please allow notifications in your browser to watch for restocks."
          : "Please enable notifications to watch for restocks.",
      );
      return;
    }
    await toggleAnyWatchRecord({
      isWatching: false,
      productId: id,
      productName: product?.name ?? "",
      listings,
      addStockWatch,
      removeAnyWatch: async () => {},
    });
    setStockWatches((prev) => ({ ...prev, "*": true }));
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast("Watching all distributors — you'll be notified when it's back in stock", "success");
  }, [id, product, listings, showToast]);

  const toggleAnyWatch = useCallback(async () => {
    if (!id || togglingWatch) return;
    setTogglingWatch(true);
    try {
      const action = await toggleAnyWatchRecord({
        isWatching: !!stockWatches["*"],
        productId: id,
        productName: product?.name ?? "",
        listings,
        addStockWatch,
        removeAnyWatch: async () => {
          const watches = await getStockWatches();
          const watch = watches.find((w) => w.productId === id && w.distributorId === "*");
          if (watch) {
            if (watch.notificationId) await cancelNotification(watch.notificationId);
            await removeStockWatch(watch.id);
          }
        },
      });
      setStockWatches((prev) => ({ ...prev, "*": action === "created" }));
      if (Platform.OS !== "web") {
        if (action === "created") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      showToast(
        action === "created"
          ? "Watching all distributors — you'll be notified when it's back in stock"
          : "Stopped watching all distributors",
        action === "created" ? "success" : "info",
      );
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Couldn't update watch", "Please try again.");
    } finally {
      setTogglingWatch(false);
    }
  }, [id, product, listings, stockWatches, togglingWatch, showToast]);

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

  const handleToggleStockWatch = useCallback(async (listing: DistributorListing) => {
    if (!id || togglingWatch) return;
    const isWatched = stockWatches[listing.distributorId];
    setTogglingWatch(true);
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
      setTogglingWatch(false);
      return;
    }

    const granted = await ensureNotificationPermission();
    if (!granted) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Permission Denied", Platform.OS === "web" ? "Please allow notifications in your browser to watch for restocks." : "Please enable notifications to watch for restocks.");
      setTogglingWatch(false);
      return;
    }

    const createDistributorWatch = async () => {
      setTogglingWatch(true);
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
          scope: "distributor",
          lastKnownStatus: listing.stockStatus,
          notificationId: notificationId ?? undefined,
        });
        setStockWatches((prev) => ({ ...prev, [listing.distributorId]: true }));
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(`Reminder set — you'll be notified when back in stock`, "success");
      } catch {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert("Couldn't set watch", "We couldn't save that restock watch. Please try again.");
      } finally {
        setTogglingWatch(false);
      }
    };

    // Hold the double-open guard while the non-blocking dialog is up; each
    // create closure and the Cancel button release it.
    showAlert(
      "Watch for restock",
      `Get notified when ${product?.name ?? "this product"} is back in stock.`,
      [
        { text: "Cancel", style: "cancel", onPress: () => setTogglingWatch(false) },
        { text: "This distributor", onPress: () => void createDistributorWatch() },
        { text: "Any distributor", onPress: () => { setTogglingWatch(false); void (async () => { try { await createAnyWatchRecord(); } catch { if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); showAlert("Couldn't set watch", "We couldn't save that restock watch. Please try again."); } })(); } },
      ],
    );
  }, [id, product, stockWatches, showToast, togglingWatch, createAnyWatchRecord]);

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
    // `id` can be a user-supplied model number (CSV import), so encode it or a
    // "/" or space produces a malformed deep link.
    const deepLink = Linking.createURL(`/product/${encodeURIComponent(id)}`, { scheme: "productstockfinder" });
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

  const handleExportCsv = useCallback(async () => {
    if (!product) return;
    const exportable = { ...product, listings };
    if (!hasExportablePriceData(exportable)) {
      showAlert("Nothing to export", "No price history is available for this product yet.");
      return;
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const fileName = `${product.modelNumber ?? product.id}-history.csv`;
    const ok = await exportCsvFile(productHistoryToCsv(exportable), fileName);
    if (!ok) {
      showAlert("Export unavailable", "We couldn't export the price history on this device.");
      return;
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast("Price history exported", "success");
  }, [product, listings, showToast]);

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
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleExportCsv}
            style={{ padding: 4, marginLeft: 8 }}
            accessibilityLabel="Export CSV"
            accessibilityRole="button"
            hitSlop={10}
          >
            <IconSymbol name="square.and.arrow.down" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </Animated.View>
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
      >
        <DetailHeader product={product} bestDeal={bestDeal} scrollY={scrollY} watchingAny={!!stockWatches["*"]} onToggleWatch={() => void toggleAnyWatch()} acquired={isAcquired(product)} onToggleAcquired={() => void handleToggleAcquired()} />
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
          {availability && <AvailabilityCard data={availability} />}
          <DistributorListingSection sortedListings={sortedListings} visibleListings={visibleListings} bestInStockListing={bestInStockListing} highlightDistributorId={highlightDistributorId} product={product} insight={insight} insightLoading={insightLoading} regionFilter={regionFilter} regions={regions} shippingRegion={effectiveShippingRegion} bestDeal={bestDeal} stockWatches={stockWatches} id={id} displayCurrency={effectiveCurrency} destination={destination} taxExempt={taxExempt} includeImportEstimate={includeImportEstimate} onSelectCountry={handleSelectCountry} onToggleTaxExempt={handleToggleTaxExempt} onToggleImportEstimate={handleToggleImportEstimate} onSetRegionFilter={setRegionFilter} onSetBestAlert={handleSetBestAlert} onToggleStockWatch={handleToggleStockWatch} onOpenChart={(listing) => router.push(`/compare/${id}?distributor=${listing.distributorId}`)} onRemind={setReminderListing} onFindPrices={handleFindPrices} findingPrices={findingPrices} onWatchAny={() => void toggleAnyWatch()} watchingAny={!!stockWatches["*"]} />
          {isOutOfStock && product?.category && (
            <AlternativesSection category={product.category} alternatives={alternatives} />
          )}
        </View>
        {/* Notes and distributor targets sit outside the shareRef capture: notes
            are device-private and targets are personal, so neither belongs in a
            shared product image. */}
        <NotesCard productId={product.id} />
        <TargetTableCard listings={visibleListings} alerts={alerts} productId={product.id} onSetTarget={handleSetTarget} />
        <AlertSection productId={product.id} productName={product.name} displayCurrency={effectiveCurrency} onAdded={(alert) => setAlerts((prev) => [...prev, alert])} />
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
        distributors={alertDistributors}
        selectedDistributorId={alertDistributorId}
        onSelectDistributor={setAlertDistributorId}
        direction={alertDirection}
        onDirectionChange={setAlertDirection}
      />
    </ScreenContainer>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
