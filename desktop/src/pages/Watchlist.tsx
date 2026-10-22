import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DISTRIBUTORS } from "@shared/distributors";
import { useNavigate, useSearchParams } from "react-router";
import {
  Package,
  Lightbulb,
} from "lucide-react";
import { useWatchlist, useSettings } from "../hooks/use-storage";
import { useToast } from "../hooks/use-toast";
import { storage } from "../storage";
import { getBestPrice } from "@/lib/currency";
import { computeWatchlistSummary } from "../../../lib/watchlist-summary";
import { getAllRegions } from "../../../lib/region-filter";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { countTagMatches, filterWatchlist, groupWatchlist, type StatusFilter } from "../../../lib/watchlist-org";
import { useConnection } from "../hooks/use-connection";
import { countQueuedEdits } from "../../../lib/sync";
import { computeProductInsights } from "../../../lib/product-insights";
import { computeDealScore, type DealScore } from "../../../lib/deal-score";
import { flattenWatchlistRows } from "../lib/watchlist-rows";
import { getTrend } from "../lib/watchlist-view";
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
import { isAcquired } from "../../../lib/acquired";
import type { Product, TagDefinition, WatchlistGroup } from "../../../lib/types";

type SortKey = "name" | "price" | "deal" | "trend" | "lastUpdated";
type FilterKey = "all" | "in_stock" | "back_order" | "out_of_stock";



export function Watchlist() {
  const { products, loading, refresh } = useWatchlist();


  const { settings } = useSettings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [groupMode, setGroupMode] = useState<WatchlistGroup>("off");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagDefinitions, setTagDefinitions] = useState<Record<string, TagDefinition>>({});
  const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any");
  const [query, setQuery] = useState("");
  const [inStockOnly, setInStockOnly] = useState(() => searchParams.get("inStock") === "1");
  const [showAcquired, setShowAcquired] = useState(false);
  const inStockParamRef = useRef(searchParams.get("inStock") === "1");
  const [priceMinInput, setPriceMinInput] = useState("");
  const [priceMaxInput, setPriceMaxInput] = useState("");
  const priceRange = useMemo<[number, number] | undefined>(() => {
    if (priceMinInput.trim() === "" && priceMaxInput.trim() === "") return undefined;
    const min = priceMinInput.trim() === "" ? 0 : Number(priceMinInput);
    const max = priceMaxInput.trim() === "" ? Number.MAX_SAFE_INTEGER : Number(priceMaxInput);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return undefined;
    return [min, max];
  }, [priceMinInput, priceMaxInput]);
  const priceInvalid =
    (priceMinInput.trim() !== "" || priceMaxInput.trim() !== "") && priceRange === undefined;
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
    void refreshQueuedCount();
    window.addEventListener("focus", refreshQueuedCount);
    return () => window.removeEventListener("focus", refreshQueuedCount);
  }, [refreshQueuedCount]);
  // Bulk select + undo parity
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Everything the removal cascade deletes for a product, so Undo can restore
  // it — `removeFromWatchlist` also drops alerts, back-order reminders, and
  // restock watches (mobile's undo only restores the product + alerts).
  const regions = useMemo(() => getAllRegions(), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Collapsing header: desktop equivalent of mobile Animated headerCollapse
  const [collapsed, setCollapsed] = useState(false);
  // BulkTagSheet — desktop Tailwind port of components/bulk-tag-sheet.tsx

  const displayCurrency = settings?.displayCurrency ?? "USD";

  const { importInputRef, handleShare, handleImportFile } = useWatchlistShare({
    products,
    displayCurrency,
    showToast,
    refresh,
  });

  useEffect(() => {
    // A storage read failure must not reject unhandled; the view prefs simply
    // keep their defaults.
    storage.getSettings().then((s) => {
      const defs = (s.tagDefinitions ?? {}) as Record<string, TagDefinition>;
      setTagDefinitions(defs);
      setSelectedTagIds((prev) => prev.filter((id) => Object.prototype.hasOwnProperty.call(defs, id)));
      if (!inStockParamRef.current) setInStockOnly(s.watchlistInStockOnly ?? false);
      setGroupMode(s.watchlistGroup ?? "off");
      setSortKey(s.watchlistSortKey ?? "name");
      setSortAsc(s.watchlistSortAsc ?? true);
      const storedRange = s.watchlistPriceRange ?? null;
      if (storedRange && Array.isArray(storedRange) && storedRange.length === 2) {
        const [min, max] = storedRange;
        setPriceMinInput(min === 0 ? "" : String(min));
        setPriceMaxInput(max === Number.MAX_SAFE_INTEGER ? "" : String(max));
      }
    }).catch(() => {});
  }, [settings]);

  useEffect(() => {
    if (loading) return;
    // Serialized updateSettings: a whole-object write with a read taken outside
    // the queue raced other settings writes (theme, basket alert) and could
    // drop their fields.
    storage
      .updateSettings({ watchlistInStockOnly: inStockOnly, watchlistPriceRange: priceRange ?? null, watchlistGroup: groupMode, watchlistSortKey: sortKey, watchlistSortAsc: sortAsc })
      .catch(() => {});
  }, [inStockOnly, priceRange, groupMode, sortKey, sortAsc, loading]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setCollapsed(el.scrollTop > 40);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [loading]);

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  // Single pipeline: apply all filters (region, status, tags, query) in one pass
  const filtered = useMemo(
    () =>
      filterWatchlist(products, {
        region: regionFilter,
        tagIds: selectedTagIds,
        tagMatchMode,
        status: filter as StatusFilter,
        query,
        priceRange,
        inStockOnly,
        displayCurrency,
      }).filter((p) => showAcquired || !isAcquired(p)),
    [products, regionFilter, selectedTagIds, tagMatchMode, filter, query, priceRange, inStockOnly, displayCurrency, showAcquired],
  );

  const summary = useMemo(
    () => computeWatchlistSummary(products, displayCurrency),
    [products, displayCurrency],
  );

  const insightMap = useMemo(() => {
    const result = computeProductInsights(products, displayCurrency);
    return new Map(result.products.map((entry) => [entry.productId, entry]));
  }, [products, displayCurrency]);

  const tagCounts = useMemo(
    () =>
      countTagMatches(products, {
        region: regionFilter,
        status: filter as StatusFilter,
        query,
        priceRange,
        inStockOnly,
        displayCurrency,
      }),
    [products, regionFilter, filter, query, inStockOnly, priceRange, displayCurrency],
  );

  const dealScores: Map<string, DealScore | null> = useMemo(
    () => new Map(filtered.map((p) => [p.id, computeDealScore(p.listings ?? [], displayCurrency)])),
    [filtered, displayCurrency],
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          // `?? ""` so a malformed product without a name doesn't throw; the
          // id tiebreak keeps the order deterministic (mobile does the same).
          cmp = (a.name ?? "").localeCompare(b.name ?? "") || a.id.localeCompare(b.id);
          break;
        case "price": {
          // `?? []` like the shared sort/mobile card: a product restored from a
          // partial backup or sync payload has no listings, and getBestPrice
          // dereferences its argument (it threw and blanked the table).
          const aPrice = getBestPrice(a.listings ?? [], displayCurrency)?.price ?? null;
          const bPrice = getBestPrice(b.listings ?? [], displayCurrency)?.price ?? null;
          if (aPrice === null && bPrice === null) cmp = 0;
          else if (aPrice === null) return 1;
          else if (bPrice === null) return -1;
          else cmp = aPrice - bPrice;
          break;
        }
        case "deal": {
          const aScore = dealScores.get(a.id)?.score ?? null;
          const bScore = dealScores.get(b.id)?.score ?? null;
          if (aScore === null && bScore === null) cmp = 0;
          else if (aScore === null) return 1;
          else if (bScore === null) return -1;
          else cmp = bScore - aScore;
          break;
        }
        case "trend": {
          const order = { up: 0, flat: 1, down: 2 };
          cmp = order[getTrend(a)] - order[getTrend(b)];
          break;
        }
        case "lastUpdated": {
          // NaN-safe: an invalid date made the comparator return NaN, which is
          // implementation-defined ordering (mobile guards the same way).
          const aTime = Date.parse(a.lastRefreshed ?? a.addedAt ?? "") || 0;
          const bTime = Date.parse(b.lastRefreshed ?? b.addedAt ?? "") || 0;
          cmp = aTime - bTime || a.id.localeCompare(b.id);
          break;
        }
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortAsc, displayCurrency, dealScores]);

  const sections = useMemo(
    () => groupWatchlist(sorted, groupMode, tagDefinitions),
    [sorted, groupMode, tagDefinitions],
  );

  const rows = useMemo(() => flattenWatchlistRows(groupMode, sorted, sections), [groupMode, sorted, sections]);

  // TanStack Virtual returns non-memoizable functions by design; the compiler
  // skipping this component is expected.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 76,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

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
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

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
