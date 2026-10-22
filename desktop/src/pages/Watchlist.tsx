import { useState, useRef, useEffect, useCallback } from "react";
import { DISTRIBUTORS } from "@shared/distributors";
import { useNavigate, useSearchParams } from "react-router";
import {
  Package,
  Lightbulb,
} from "lucide-react";
import { useWatchlist, useSettings } from "../hooks/use-storage";
import { useToast } from "../hooks/use-toast";
import { storage } from "../storage";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useConnection } from "../hooks/use-connection";
import { countQueuedEdits } from "../../../lib/sync";
import { OfflineBanner } from "../components/watchlist/OfflineBanner";
import { WatchlistRow } from "../components/watchlist/WatchlistRow";
import { WatchlistFilters } from "../components/watchlist/WatchlistFilters";
import { WatchlistTableHeader } from "../components/watchlist/WatchlistTableHeader";
import { WatchlistDialogs } from "../components/watchlist/WatchlistDialogs";
import { WatchlistToolbar } from "../components/watchlist/WatchlistToolbar";
import { WatchlistEmptyState } from "../components/watchlist/WatchlistEmptyState";
import { WatchlistTableBody } from "../components/watchlist/WatchlistTableBody";
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
      <div className="p-6 space-y-4">
      <OfflineBanner queuedCount={queuedCount} isOffline={connection.status === "offline"} />
      {listError && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
            <span className="flex-1">Couldn&apos;t load watchlist: {listError}</span>
            <button
              onClick={() => void handleRetryList()}
              className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
              aria-label="Retry loading watchlist"
            >
              Retry
            </button>
          </div>
        )}
        <EmptyState
          icon={<Package className="w-8 h-8" />}
          title="No products yet"
          description={`Add a part and we'll watch all ${DISTRIBUTORS.length} distributors — alerting you the moment it's in stock or cheaper.`}
          action={{ label: "Browse Products", to: "/search" }}
        />
        <div className="flex justify-center">
          <p className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
            Tip: Search for MikroTik CRS, Ubiquiti U7, RTX 4090, Pi 5, etc.
          </p>
        </div>
      </div>
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

      <div
        ref={scrollRef}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[60vh] overflow-y-auto"
      >
        <div className="overflow-x-auto">
          <table className="w-full" aria-rowcount={rows.length}>
            <WatchlistTableHeader
              selectionMode={selectionMode}
              sortKey={sortKey}
              sortAsc={sortAsc}
              onSort={handleSort}
            />
          <WatchlistTableBody
            rows={rows}
            virtualRows={virtualRows}
            selectionMode={selectionMode}
            rowVirtualizer={rowVirtualizer}
            renderRow={renderRow}
          />
          </table>
        </div>

        {sorted.length === 0 && (
          <WatchlistEmptyState
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
        )}
      </div>
      {undoProduct && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50">
          <span>Removed {undoProduct.name}</span>
          <button onClick={handleUndo} className="px-3 py-1 rounded-lg bg-white text-gray-900 text-xs font-semibold hover:bg-gray-100">Undo</button>
          <button onClick={() => setUndoProduct(null)} className="p-1 rounded hover:bg-white/10" aria-label="Dismiss undo">×</button>
        </div>
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
