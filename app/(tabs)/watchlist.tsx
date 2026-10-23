
import { Animated, Platform } from "react-native";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { WatchlistFilterPanel } from "@/components/watchlist/watchlist-filter-panel";
import { WatchlistListHeader } from "@/components/watchlist/watchlist-list-header";
import { WatchlistLoadingSkeleton } from "@/components/watchlist/watchlist-loading-skeleton";
import { WatchlistSheets } from "@/components/watchlist/watchlist-sheets";
import { WatchlistSectionList } from "@/components/watchlist/watchlist-section-list";
import { isAcquired } from "@/lib/acquired";
import { useWatchlistScreen } from "@/hooks/use-watchlist-screen";
import { WatchlistHeader } from "@/components/watchlist/watchlist-header";
import { EmptyState } from "@/components/watchlist/empty-state";

// The header content lives in the list's ListHeaderComponent so it scrolls
// away with the content (QA round 8: as flex siblings it squeezed the list
// into a ~240px strip at the bottom of the screen).
export default function WatchlistScreen() {
  const screen = useWatchlistScreen();
  const {
    router,
    colors,
    insets,
    watchlist,
    loaded,
    isRefreshingAny,
    reload,
    loadData,
    refreshAll,
    paywallVisible,
    setPaywallVisible,
    sortMenuOpen,
    setSortMenuOpen,
    displayCurrency,
    tagDefinitions,
    filters,
    summary,
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
    sectionData,
    renderSectionHeader,
    renderItem,
  } = screen;
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
    toggleTagFilter,
    activeFilterCount,
    filtersExpanded,
    clearAllFilters,
  } = filters;
  const {
    selectionMode,
    selectedIds,
    bulkTagVisible,
    setBulkTagVisible,
    exitSelection,
  } = selection;
  const { checking, checkProgress, handleRefreshAll, handleCheckNow } = refresh;
  const {
    undoProduct,
    handleUndo,
    handleBulkDelete,
    handleBulkTagChanged,
  } = remove;

  if (!loaded) return <WatchlistLoadingSkeleton />;

  const listHeader = (

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
  );

  const listEmpty = (

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
  );

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

      <WatchlistSectionList
        sectionData={sectionData}
        groupMode={groupMode}
        isRefreshingAny={isRefreshingAny}
        refreshAll={refreshAll}
        colors={colors}
        listHeader={listHeader}
        listEmpty={listEmpty}
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
