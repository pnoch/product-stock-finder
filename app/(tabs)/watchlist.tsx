import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  SectionList,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useSettings } from "@/lib/settings-provider";
import { useWatchlistRemove } from "@/hooks/use-watchlist-remove";
import { useWatchlistSelection } from "@/hooks/use-watchlist-selection";
import { useWatchlistRefresh } from "@/hooks/use-watchlist-refresh";
import { useWatchlistFilters } from "@/hooks/use-watchlist-filters";
import { useWatchlistShare } from "@/hooks/use-watchlist-share";
import { useWatchlistImport } from "@/hooks/use-watchlist-import";
import { useWatchlistFindPrices } from "@/hooks/use-watchlist-find-prices";
import { WatchlistFilterPanel } from "@/components/watchlist/watchlist-filter-panel";
import { WatchlistListHeader } from "@/components/watchlist/watchlist-list-header";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { track } from "@/lib/telemetry";
import { useLiveWatchlist } from "@/hooks/use-live-prices";
import { useConnection } from "@/hooks/use-connection";
import { trpc } from "@/lib/trpc";
import {
  getAlerts,
  getSyncMeta,
  updateProductAcquired,
} from "@/lib/storage";
import { useToast } from "@/components/ui/toast";
import { countQueuedEdits } from "@/lib/sync";
import { computeWatchlistSummary } from "@/lib/watchlist-summary";
import { computeProductInsights } from "@/lib/product-insights";
import { computeDealScore } from "@/lib/deal-score";
import {
  PriceAlert,
  Product,
} from "@/lib/types";
import { getAllRegions } from "@/lib/region-filter";
import {
} from "@/lib/watchlist-org";
import { WatchlistRow } from "@/components/watchlist/watchlist-row";
import { WatchlistSectionHeader } from "@/components/watchlist/watchlist-section-header";
import { WatchlistLoadingSkeleton } from "@/components/watchlist/watchlist-loading-skeleton";
import { WatchlistSheets } from "@/components/watchlist/watchlist-sheets";
import { isAcquired } from "@/lib/acquired";
import { WatchlistHeader } from "@/components/watchlist/watchlist-header";
import { EmptyState } from "@/components/watchlist/empty-state";
import { LOG_ERROR, log } from "@shared/log";

// The header content lives in the list's ListHeaderComponent so it scrolls
// away with the content (QA round 8: as flex siblings it squeezed the list
// into a ~240px strip at the bottom of the screen).
export default function WatchlistScreen() {
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

  const {
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    regionFilter,
    setRegionFilter,
    inStockOnly,
    setInStockOnly,
    showAcquired,
    setShowAcquired,
    setFiltersManual,
    priceRange,
    setPriceRange,
    priceMinInput,
    setPriceMinInput,
    priceMaxInput,
    setPriceMaxInput,
    setSelectedTagIds,
    tagMatchMode,
    setTagMatchMode,
    sortMode,
    setSortMode,
    groupMode,
    setGroupMode,
    sortModeRef,
    groupModeRef,
    persistViewPrefs,
    validSelectedTagIds,
    filteredWatchlist,
    tagCounts,
    sections,
    toggleTagFilter,
    activeFilterCount,
    filtersExpanded,
    clearAllFilters,
  } = useWatchlistFilters({
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
  const headerCollapse = scrollY.interpolate({ inputRange: [0, 80], outputRange: [1, 0], extrapolate: "clamp" });
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
        showAlert("Update failed", "We couldn't update that product. Please try again.");
      }
    },
    [reload],
  );

  // Swipe "Alert" action: alerts are created on the product detail screen
  // (the watch row itself has no alert composer), so the swipe opens it.
  const handleSwipeAlert = useCallback((product: Product) => {
    router.push(`/product/${product.id}`);
  }, [router]);

  const alertProductIds = useMemo(
    () => new Set(alerts.filter((a) => a.isActive && !a.triggeredAt).map((a) => a.productId)),
    [alerts],
  );

  const {
    selectionMode,
    selectedIds,
    bulkTagVisible,
    setBulkTagVisible,
    toggleSelection,
    enterSelection,
    exitSelection,
  } = useWatchlistSelection();

  const { checking, checkProgress, handleRefreshAll, handleCheckNow } =
    useWatchlistRefresh({
      watchlistLength: watchlist.length,
      refreshAll,
      reload,
      loadData,
      showAlert,
    });

  const {
    undoProduct,
    handleDelete,
    handleUndo,
    handleBulkDelete,
    handleBulkTagChanged,
  } = useWatchlistRemove({
    selectedIds,
    exitSelection,
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

  const { findingIds, handleFindPrices } = useWatchlistFindPrices({
    reload,
    showToast,
  });

  const sectionData = useMemo(() => sections.map((s) => ({ ...s, data: s.products.map((p) => ({ ...p, _sectionKey: s.key } as Product & { _sectionKey: string })) })), [sections]);
  const handleProductPress = useCallback((product: Product) => {
    if (selectionMode) toggleSelection(product.id);
    else router.push(`/product/${product.id}`);
  }, [selectionMode, toggleSelection, router]);
  const handleProductLongPress = useCallback(
    (product: Product) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      enterSelection(product.id);
    },
    [enterSelection],
  );
  const renderSectionHeader = useCallback(
    ({
      section,
    }: {
      section: { key: string; title: string; products: Product[] };
    }) => (
      <WatchlistSectionHeader
        section={section}
        groupMode={groupMode}
        tagDefinitions={tagDefinitions}
      />
    ),
    [groupMode, tagDefinitions],
  );

  // Memoized so unrelated state changes (sheets, query, prefs) don't rebuild and
  // re-render every visible row; combined with the stabilized `liveProducts` in
  // use-live-prices this keeps the SectionList cheap on large watchlists.
  const renderItem = useCallback(
    ({ item }: { item: Product & { _sectionKey?: string } }) => (
      <WatchlistRow
        product={item}
        displayCurrency={displayCurrency}
        selectionMode={selectionMode}
        insight={
          insightMap.has(item.id)
            ? {
                atAllTimeLow: insightMap.get(item.id)!.atAllTimeLow,
                dropStreak: insightMap.get(item.id)!.dropStreak,
              }
            : undefined
        }
        dealScore={dealScoreMap.get(item.id) ?? undefined}
        selected={selectedIds.has(item.id)}
        findingPrices={findingIds.has(item.id)}
        hasAlert={alertProductIds.has(item.id)}
        isAcquired={isAcquired(item)}
        tagDefinitions={tagDefinitions}
        onPress={() => handleProductPress(item)}
        onLongPress={() => handleProductLongPress(item)}
        onDelete={() => handleDelete(item)}
        onTagPress={() => setPickerProduct(item)}
        onFindPrices={() => handleFindPrices(item)}
        onToggleAcquired={() => void handleToggleAcquired(item)}
        onToggleAlert={() => handleSwipeAlert(item)}
      />
    ),
    [
      selectionMode,
      displayCurrency,
      insightMap,
      dealScoreMap,
      selectedIds,
      findingIds,
      tagDefinitions,
      handleProductPress,
      handleProductLongPress,
      handleDelete,
      handleFindPrices,
      handleToggleAcquired,
      handleSwipeAlert,
      alertProductIds,
    ],
  );

  if (!loaded) return <WatchlistLoadingSkeleton />;

  return (
    <ScreenContainer>
      <Animated.View
        style={{
          opacity: headerCollapse.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 1] }),
          transform: [
            {
              translateY: scrollY.interpolate({ inputRange: [0, 80], outputRange: [0, -10], extrapolate: "clamp" }),
            },
          ],
        }}
      >
        <WatchlistHeader
          mode={selectionMode ? "selection" : "normal"}
          selectedCount={selectedIds.size}
          watchlistLength={watchlist.length}
          filteredCount={filteredWatchlist.length}
          isRefreshingAny={isRefreshingAny}
          checking={checking}
          checkProgress={checkProgress}
          onAnalysis={() => router.push("/distributor-analysis")}
          onRefresh={handleRefreshAll}
          onCheckNow={handleCheckNow}
          onAdd={() => router.push("/search")}
          onImport={handleImportCsv}
          onBulkDelete={handleBulkDelete}
          onBulkTag={() => setBulkTagVisible(true)}
          onExitSelection={exitSelection}
          onShare={handleShareWatchlist}
        />
      </Animated.View>

                                          <SectionList
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
        // QA round 8: scroll gestures were dead on device with
        // removeClippedSubviews enabled on Android.
        removeClippedSubviews={false}
        sections={sectionData}
        keyExtractor={(item: Product & { _sectionKey?: string }) => `${item.id}-${item._sectionKey ?? ''}`}
        extraData={groupMode}
        initialNumToRender={8}
        windowSize={7}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 24,
          flexGrow: 1,
        }}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingAny}
            onRefresh={() => void refreshAll()}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
            titleColor={colors.muted}
          />
        }
        ListHeaderComponent={
          <WatchlistListHeader
            watchlistLength={watchlist.length}
            summary={summary}
            displayCurrency={displayCurrency}
            statusFilter={statusFilter}
            onStatusToggle={setStatusFilter}
            onViewStats={() => router.push("/stats")}
            onPlanOrder={() => router.push("/build-order")}
            onSourcing={() => router.push("/sourcing")}
            query={query}
            onQueryChange={setQuery}
            checking={checking}
            checkProgress={checkProgress}
            sortMode={sortMode}
            groupMode={groupMode}
            sortMenuOpen={sortMenuOpen}
            onSortModeChange={(mode) => {
              setSortMode(mode);
              setSortMenuOpen(false);
              void persistViewPrefs(mode, groupModeRef.current);
            }}
            onGroupModeChange={(mode) => {
              setGroupMode(mode);
              void persistViewPrefs(sortModeRef.current, mode);
            }}
            onSortMenuToggle={() => setSortMenuOpen((v) => !v)}
            filtersExpanded={filtersExpanded}
            onToggleFilters={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFiltersManual((v) => !(v ?? activeFilterCount > 0));
            }}
            activeFilterCount={activeFilterCount}
            offline={connection.status === "offline"}
            queuedCount={queuedCount}
            filterPanel={
              <WatchlistFilterPanel
                visible={filtersExpanded && watchlist.length > 0}
                regions={regions}
                regionFilter={regionFilter}
                onRegionChange={setRegionFilter}
                inStockOnly={inStockOnly}
                onInStockOnlyChange={setInStockOnly}
                showAcquired={showAcquired}
                onShowAcquiredChange={setShowAcquired}
                displayCurrency={displayCurrency}
                priceMinInput={priceMinInput}
                priceMaxInput={priceMaxInput}
                onPriceMinChange={setPriceMinInput}
                onPriceMaxChange={setPriceMaxInput}
                onClearPrice={() => {
                  setPriceRange(undefined);
                  setPriceMinInput("");
                  setPriceMaxInput("");
                }}
                priceFilterActive={
                  !!priceRange || priceMinInput !== "" || priceMaxInput !== ""
                }
                tagDefinitions={tagDefinitions}
                selectedTagIds={validSelectedTagIds}
                tagMatchMode={tagMatchMode}
                tagCounts={tagCounts}
                onToggleTag={toggleTagFilter}
                onChangeTagMode={setTagMatchMode}
                onClearTags={() => setSelectedTagIds([])}
                onManageTags={() => setManageVisible(true)}
                activeFilterCount={activeFilterCount}
                onClearAll={clearAllFilters}
              />
            }
          />
        }
        ListEmptyComponent={
          <EmptyState
            query={query}
            statusFilter={statusFilter}
            regionFilter={regionFilter}
            selectedTagIds={validSelectedTagIds}
            inStockOnly={inStockOnly}
            priceRange={priceRange}
            allAcquired={watchlist.length > 0 && watchlist.every(isAcquired)}
            onClearFilters={clearAllFilters}
            onAddProduct={() => router.push("/search")}
          />
        }
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
      />
      <WatchlistSheets
        pickerProduct={pickerProduct}
        onClosePicker={() => setPickerProduct(null)}
        manageVisible={manageVisible}
        onCloseManage={() => setManageVisible(false)}
        bulkTagVisible={bulkTagVisible}
        onCloseBulkTag={() => setBulkTagVisible(false)}
        selectedIds={selectedIds}
        tagDefinitions={tagDefinitions}
        onChanged={() => {
          void reload();
          void loadData();
        }}
        onBulkTagChanged={handleBulkTagChanged}
        undoProduct={undoProduct}
        onUndo={handleUndo}
        bottomInset={insets.bottom}
        paywallVisible={paywallVisible}
        onClosePaywall={() => setPaywallVisible(false)}
      />
    </ScreenContainer>
  );
}
