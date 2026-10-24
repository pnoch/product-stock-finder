import { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";
import { useColors } from "@/hooks/use-colors";
import { useSettings } from "@/lib/settings-provider";
import { useWatchlistRemove } from "@/hooks/use-watchlist-remove";
import { useWatchlistSelection } from "@/hooks/use-watchlist-selection";
import { useWatchlistRefresh } from "@/hooks/use-watchlist-refresh";
import { useWatchlistFilters } from "@/hooks/use-watchlist-filters";
import { useWatchlistShare } from "@/hooks/use-watchlist-share";
import { useWatchlistImport } from "@/hooks/use-watchlist-import";
import { useWatchlistFindPrices } from "@/hooks/use-watchlist-find-prices";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { track } from "@/lib/telemetry";
import { useLiveWatchlist } from "@/hooks/use-live-prices";
import { useConnection } from "@/hooks/use-connection";
import { trpc } from "@/lib/trpc";
import { getAlerts, getSyncMeta, updateProductAcquired } from "@/lib/storage";
import { useToast } from "@/components/ui/toast";
import { countQueuedEdits } from "@/lib/sync";
import { computeWatchlistSummary } from "@/lib/watchlist-summary";
import { computeProductInsights } from "@/lib/product-insights";
import { computeDealScore } from "@/lib/deal-score";
import type { PriceAlert, Product } from "@/lib/types";
import { getAllRegions } from "@/lib/region-filter";
import { useWatchlistRenderers } from "@/hooks/use-watchlist-renderers";
import { isAcquired } from "@/lib/acquired";
import { LOG_ERROR, log } from "@shared/log";

export function useWatchlistScreen() {
  const router = useRouter();
  const colors = useColors();
  const { showToast } = useToast();
  const { settings, loading: settingsLoading } = useSettings();
  const insets = useSafeAreaInsets();
  const {
    products: watchlist,
    loaded,
    isRefreshingAny,
    reload,
    refreshAll,
  } = useLiveWatchlist();
  const { isAuthenticated } = useAuth();
  const { isPro } = useEntitlements();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const createShareLink = trpc.sharedWatchlists.create.useMutation();
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const displayCurrency = settings.displayCurrency;
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const tagDefinitions = useMemo(
    () => settings.tagDefinitions ?? {},
    [settings.tagDefinitions],
  );

  const filters = useWatchlistFilters({
    settings,
    settingsLoading,
    watchlist,
    displayCurrency,
    tagDefinitions,
  });

  const summary = useMemo(
    () => computeWatchlistSummary(watchlist, displayCurrency),
    [watchlist, displayCurrency],
  );

  const insightMap = useMemo(() => {
    const result = computeProductInsights(watchlist, displayCurrency);
    return new Map(result.products.map((p) => [p.productId, p] as const));
  }, [watchlist, displayCurrency]);

  const dealScoreMap = useMemo(() => {
    return new Map(
      watchlist.map(
        (p) =>
          [p.id, computeDealScore(p.listings ?? [], displayCurrency)] as const,
      ),
    );
  }, [watchlist, displayCurrency]);

  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [manageVisible, setManageVisible] = useState(false);
  const regions = useMemo(() => getAllRegions(), []);
  const scrollY = useState(() => new Animated.Value(0))[0];
  const headerCollapse = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const connection = useConnection();
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refreshQueue = async () => {
      try {
        const meta = await getSyncMeta();
        if (!cancelled) setQueuedCount(countQueuedEdits(meta));
      } catch (e) {
        LOG_ERROR("[Watchlist] queued-count refresh failed", e);
      }
    };
    void refreshQueue();
    const interval = setInterval(refreshQueue, 30000);
    const onFocus = () => void refreshQueue();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshQueue();
    };
    if (Platform.OS === "web") {
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (Platform.OS === "web") {
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [watchlist.length]);

  const reloadAlerts = useCallback(async () => {
    try {
      setAlerts(await getAlerts());
    } catch (e) {
      log.error("[Watchlist] alerts reload failed", e);
    }
  }, []);
  const loadData = useCallback(async () => {
    await reloadAlerts();
  }, [reloadAlerts]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      void loadData();
    }, [reload, loadData]),
  );

  const handleToggleAcquired = useCallback(
    async (product: Product) => {
      try {
        await updateProductAcquired(
          product.id,
          isAcquired(product) ? null : new Date().toISOString(),
        );
        await reload();
      } catch (e) {
        log.error("[Watchlist] toggle acquired failed", e);
        showAlert(
          "Update failed",
          "We couldn't update that product. Please try again.",
        );
      }
    },
    [reload],
  );

  const handleSwipeAlert = useCallback(
    (product: Product) => {
      router.push(`/product/${product.id}`);
    },
    [router],
  );

  const alertProductIds = useMemo(
    () =>
      new Set(
        alerts
          .filter((a) => a.isActive && !a.triggeredAt)
          .map((a) => a.productId),
      ),
    [alerts],
  );

  const selection = useWatchlistSelection();

  const refresh = useWatchlistRefresh({
    watchlistLength: watchlist.length,
    refreshAll,
    reload,
    loadData,
    showAlert,
  });

  const remove = useWatchlistRemove({
    selectedIds: selection.selectedIds,
    exitSelection: selection.exitSelection,
    reload,
    reloadAlerts,
    loadData,
    showAlert,
  });

  const { handleShareWatchlist } = useWatchlistShare({
    watchlist,
    displayCurrency,
    isAuthenticated,
    createShareLink,
    showAlert,
  });

  const { handleImportCsv } = useWatchlistImport({
    isPro,
    reload,
    loadData,
    showAlert,
    setPaywallVisible,
    track,
  });

  const { findingIds, findingProgress, handleFindPrices } =
    useWatchlistFindPrices({
      reload,
      showToast,
    });

  const sectionData = useMemo(
    () =>
      filters.sections.map((s) => ({
        ...s,
        data: s.products.map(
          (p) =>
            ({ ...p, _sectionKey: s.key }) as Product & {
              _sectionKey: string;
            },
        ),
      })),
    [filters.sections],
  );
  const handleProductPress = useCallback(
    (product: Product) => {
      if (selection.selectionMode) selection.toggleSelection(product.id);
      else router.push(`/product/${product.id}`);
    },
    [selection, router],
  );
  const handleProductLongPress = useCallback(
    (product: Product) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      selection.enterSelection(product.id);
    },
    [selection],
  );
  const { renderSectionHeader, renderItem } = useWatchlistRenderers({
    groupMode: filters.groupMode,
    tagDefinitions,
    selectionMode: selection.selectionMode,
    displayCurrency,
    insightMap,
    dealScoreMap,
    selectedIds: selection.selectedIds,
    findingIds,
    findingProgress,
    alertProductIds,
    handleProductPress,
    handleProductLongPress,
    handleDelete: remove.handleDelete,
    setPickerProduct,
    handleFindPrices,
    handleToggleAcquired,
    handleSwipeAlert,
  });

  return {
    router,
    colors,
    showToast,
    settings,
    insets,
    watchlist,
    loaded,
    isRefreshingAny,
    reload,
    loadData,
    refreshAll,
    isAuthenticated,
    isPro,
    paywallVisible,
    setPaywallVisible,
    sortMenuOpen,
    setSortMenuOpen,
    displayCurrency,
    alerts,
    tagDefinitions,
    filters,
    summary,
    insightMap,
    dealScoreMap,
    pickerProduct,
    setPickerProduct,
    manageVisible,
    setManageVisible,
    regions,
    scrollY,
    headerCollapse,
    connection,
    queuedCount,
    selection,
    refresh,
    remove,
    handleShareWatchlist,
    handleImportCsv,
    findingIds,
    findingProgress,
    handleFindPrices,
    sectionData,
    handleProductPress,
    handleProductLongPress,
    renderSectionHeader,
    renderItem,
  };
}
