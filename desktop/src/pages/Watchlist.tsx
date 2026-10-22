import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useWatchlist, useSettings } from "../hooks/use-storage";
import { useToast } from "../hooks/use-toast";
import { storage } from "../storage";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useConnection } from "../hooks/use-connection";
import { countQueuedEdits } from "../../../lib/sync";
import { OfflineBanner } from "../components/watchlist/OfflineBanner";
import { WatchlistRow } from "../components/watchlist/WatchlistRow";
import { WatchlistFilters } from "../components/watchlist/WatchlistFilters";
import { WatchlistDialogs } from "../components/watchlist/WatchlistDialogs";
import { WatchlistEmptyPage } from "../components/watchlist/WatchlistEmptyPage";
import { WatchlistTable } from "../components/watchlist/WatchlistTable";
import { WatchlistUndoToast } from "../components/watchlist/WatchlistUndoToast";
import { WatchlistToolbar } from "../components/watchlist/WatchlistToolbar";
import { useWatchlistShare } from "../hooks/use-watchlist-share";
import { useWatchlistRemove } from "../hooks/use-watchlist-remove";
import { useWatchlistTags } from "../hooks/use-watchlist-tags";
import { useWatchlistRefresh } from "../hooks/use-watchlist-refresh";
import { useWatchlistView } from "../hooks/use-watchlist-view";
import { isAcquired } from "../../../lib/acquired";
import type { Product, TagDefinition } from "../../../lib/types";



export function Watchlist() {
  const { products, loading, refresh } = useWatchlist();


  const { settings } = useSettings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tagDefinitions, setTagDefinitions] = useState<Record<string, TagDefinition>>({});
  const { toast, showToast } = useToast();
  const connection = useConnection();

  const {
    listError,
    refreshing,
    refreshProgress,
    checking,
    checkProgress,
    findingIds,
    handleRetryList,
    handleRefresh,
    handleCheckNow,
    handleFindPrices,
  } = useWatchlistRefresh({
    products,
    loading,
    refresh,
    showToast,
  });
  const [queuedCount, setQueuedCount] = useState(0);

  const refreshQueuedCount = useCallback(async () => {
    try {
      const meta = await storage.getSyncMeta();
      setQueuedCount(countQueuedEdits(meta));
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshQueuedCount();
    });
    window.addEventListener("focus", refreshQueuedCount);
    return () => window.removeEventListener("focus", refreshQueuedCount);
  }, [refreshQueuedCount]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayCurrency = settings?.displayCurrency ?? "USD";

  const { importInputRef, handleShare, handleImportFile } = useWatchlistShare({
    products,
    displayCurrency,
    showToast,
    refresh,
  });

  const {
    sortKey,
    sortAsc,
    groupMode,
    setGroupMode,
    filter,
    setFilter,
    regionFilter,
    setRegionFilter,
    selectedId,
    setSelectedId,
    selectedTagIds,
    setSelectedTagIds,
    tagMatchMode,
    setTagMatchMode,
    query,
    setQuery,
    inStockOnly,
    setInStockOnly,
    showAcquired,
    setShowAcquired,
    priceMinInput,
    setPriceMinInput,
    priceMaxInput,
    setPriceMaxInput,
    priceInvalid,
    selectionMode,
    setSelectionMode,
    selectedIds,
    collapsed,
    regions,
    filtered,
    summary,
    insightMap,
    tagCounts,
    dealScores,
    sorted,
    rows,
    rowVirtualizer,
    virtualRows,
    toggleTagFilter,
    toggleSelection,
    exitSelection,
    handleSort,
  } = useWatchlistView({
    products,
    displayCurrency,
    tagDefinitions,
    searchParams,
    scrollRef,
    loading,
    settings,
  });

  const {
    undoProduct,
    setUndoProduct,
    handleUndo,
    handleRemove,
    handleBulkDelete,
  } = useWatchlistRemove({
    products,
    selectedIds,
    exitSelection,
    refresh,
    showToast,
  });

  const {
    manageOpen,
    setManageOpen,
    editingTagId,
    setEditingTagId,
    editingTagName,
    setEditingTagName,
    editingTagColor,
    setEditingTagColor,
    manageError,
    setManageError,
    newTagName,
    setNewTagName,
    newTagColor,
    setNewTagColor,
    bulkOpen,
    setBulkOpen,
    bulkSelectedTagIds,
    bulkNewTagName,
    setBulkNewTagName,
    bulkNewTagColor,
    setBulkNewTagColor,
    bulkError,
    tagPickerProduct,
    setTagPickerProduct,
    handleCreateTag,
    handleUpdateTag,
    handleRecolorTag,
    handleDeleteTag,
    toggleBulkTag,
    handleBulkCreateTag,
    handleBulkApply,
    openBulkTagSheet,
    handleToggleProductTag,
  } = useWatchlistTags({
    settings,
    tagDefinitions,
    setTagDefinitions,
    setSelectedTagIds,
    selectedIds,
    exitSelection,
    refresh,
    showToast,
  });
  const handleToggleAcquired = async (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    try {
      await storage.updateProductAcquired(product.id, isAcquired(product) ? null : new Date().toISOString());
      await refresh();
    } catch {
      showToast("Couldn't update acquired status");
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <LoadingSpinner size="large" label="Loading watchlist..." />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <WatchlistEmptyPage
        queuedCount={queuedCount}
        isOffline={connection.status === "offline"}
        listError={listError}
        onRetry={() => void handleRetryList()}
      />
    );
  }

  const renderRow = (
    product: Product,
    virtual?: { ref: (el: HTMLTableRowElement | null) => void; index: number },
  ) => (
    <WatchlistRow
      product={product}
      virtual={virtual}
      displayCurrency={displayCurrency}
      selectionMode={selectionMode}
      selectedId={selectedId}
      selectedIds={selectedIds}
      insightMap={insightMap}
      dealScores={dealScores}
      tagDefinitions={tagDefinitions}
      findingIds={findingIds}
      isAcquired={isAcquired}
      onOpen={(id) => {
        setSelectedId(id);
        navigate(`/product/${id}`);
      }}
      onToggleSelection={toggleSelection}
      onFindPrices={handleFindPrices}
      onToggleAcquired={handleToggleAcquired}
      onEditTags={setTagPickerProduct}
      onRemove={handleRemove}
    />
  );

  return (
    <div className="p-6 space-y-4">
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 animate-fadeIn">
          {toast}
        </div>
      )}
      <WatchlistToolbar
        collapsed={collapsed}
        productsCount={products.length}
        filteredCount={filtered.length}
        selectionMode={selectionMode}
        selectedCount={selectedIds.size}
        refreshing={refreshing}
        refreshProgress={refreshProgress}
        checking={checking}
        checkProgress={checkProgress}
        importInputRef={importInputRef}
        onSelectMode={() => setSelectionMode(true)}
        onBulkTag={openBulkTagSheet}
        onBulkDelete={handleBulkDelete}
        onCancelSelection={exitSelection}
        onDistributorAnalysis={() => navigate("/distributor-analysis")}
        onShare={handleShare}
        onImportFile={handleImportFile}
        onImportClick={() => importInputRef.current?.click()}
        onCheckNow={handleCheckNow}
        onRefresh={handleRefresh}
        onManageTags={() => setManageOpen(true)}
        onAddProduct={() => navigate("/search")}
      />

      <OfflineBanner queuedCount={queuedCount} isOffline={connection.status === "offline"} />

      <WatchlistFilters
        summary={summary}
        displayCurrency={displayCurrency}
        filter={filter}
        onFilterChange={setFilter}
        inStockOnly={inStockOnly}
        onInStockOnlyChange={setInStockOnly}
        showAcquired={showAcquired}
        onShowAcquiredChange={setShowAcquired}
        priceMinInput={priceMinInput}
        onPriceMinChange={setPriceMinInput}
        priceMaxInput={priceMaxInput}
        onPriceMaxChange={setPriceMaxInput}
        priceInvalid={priceInvalid}
        groupMode={groupMode}
        onGroupModeChange={setGroupMode}
        regions={regions}
        regionFilter={regionFilter}
        onRegionChange={setRegionFilter}
        tagDefinitions={tagDefinitions}
        selectedTagIds={selectedTagIds}
        tagMatchMode={tagMatchMode}
        tagCounts={tagCounts}
        onToggleTag={toggleTagFilter}
        onChangeTagMode={setTagMatchMode}
        onClearTags={() => setSelectedTagIds([])}
        onManageTags={() => setManageOpen(true)}
        query={query}
        onQueryChange={setQuery}
        listError={listError}
        onRetryList={() => void handleRetryList()}
      />

      <WatchlistTable
        scrollRef={scrollRef}
        rows={rows}
        virtualRows={virtualRows}
        selectionMode={selectionMode}
        sortKey={sortKey}
        sortAsc={sortAsc}
        onSort={handleSort}
        rowVirtualizer={rowVirtualizer}
        renderRow={renderRow}
        sortedLength={sorted.length}
        products={products}
        showAcquired={showAcquired}
        onClearFilters={() => {
          setFilter("all");
          setQuery("");
          setRegionFilter("all");
          setSelectedTagIds([]);
          setInStockOnly(false);
          setPriceMinInput("");
          setPriceMaxInput("");
          setShowAcquired(true);
        }}
      />

      {undoProduct && (
        <WatchlistUndoToast
          product={undoProduct}
          onUndo={handleUndo}
          onDismiss={() => setUndoProduct(null)}
        />
      )}
      <WatchlistDialogs
        manageOpen={manageOpen}
        onCloseManage={() => {
          setManageOpen(false);
          setEditingTagId(null);
          setManageError(null);
        }}
        tagDefinitions={tagDefinitions}
        manageError={manageError}
        editingTagId={editingTagId}
        editingTagName={editingTagName}
        onEditingTagNameChange={setEditingTagName}
        editingTagColor={editingTagColor}
        onEditingTagColorChange={setEditingTagColor}
        onEditTag={(def) => {
          setEditingTagId(def.id);
          setEditingTagName(def.name);
          setEditingTagColor(def.color);
          setManageError(null);
        }}
        onCancelEditTag={() => {
          setEditingTagId(null);
          setManageError(null);
        }}
        onUpdateTag={handleUpdateTag}
        onDeleteTag={handleDeleteTag}
        onRecolorTag={handleRecolorTag}
        newTagName={newTagName}
        onNewTagNameChange={setNewTagName}
        newTagColor={newTagColor}
        onNewTagColorChange={setNewTagColor}
        onCreateTag={handleCreateTag}
        bulkOpen={bulkOpen}
        onCloseBulk={() => setBulkOpen(false)}
        selectedIds={selectedIds}
        bulkError={bulkError}
        bulkSelectedTagIds={bulkSelectedTagIds}
        onToggleBulkTag={toggleBulkTag}
        bulkNewTagName={bulkNewTagName}
        onBulkNewTagNameChange={setBulkNewTagName}
        bulkNewTagColor={bulkNewTagColor}
        onBulkNewTagColorChange={setBulkNewTagColor}
        onBulkCreateTag={handleBulkCreateTag}
        onBulkApply={handleBulkApply}
        tagPickerProduct={tagPickerProduct}
        onCloseTagPicker={() => setTagPickerProduct(null)}
        onToggleProductTag={handleToggleProductTag}
      />
    </div>
  );
}
