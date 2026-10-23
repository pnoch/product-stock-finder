import { useEffect, useRef } from "react";
import { Search, Upload, PenLine } from "lucide-react";
import { PRODUCT_CATALOG } from "@shared/catalog";
import { Modal } from "./Modal";
import { useCatalogSearch } from "../hooks/use-catalog-search";
import {
  RECENT_KEY,
  recordRecent,
  CATALOG_SORT_OPTIONS,
  PillFilterRow,
} from "./search-chrome";
import { TagPickerDialog } from "./search/TagPickerDialog";
import { BulkImportDialog } from "./search/BulkImportDialog";
import { SearchModalResults } from "./search/SearchModalResults";
import { SearchModalManualAddDialog } from "./search/SearchModalManualAddDialog";

export function SearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    query,
    setQuery,
    recentSearches,
    setRecentSearches,
    discoveredProducts,
    categories,
    brands,
    selectedCategory,
    setSelectedCategory,
    selectedBrand,
    setSelectedBrand,
    catalogSort,
    setCatalogSort,
    sortedResults,
    trackedIds,
    pendingTags,
    tagDefinitions,
    discovering,
    discoverError,
    toast,
    inputRef,
    bulkOpen,
    setBulkOpen,
    bulkText,
    setBulkText,
    bulkPreview,
    bulkNew,
    bulkImporting,
    handleBulkImport,
    manualOpen,
    closeManualModal,
    manualTimedOut,
    manualRetrying,
    manualProgress,
    manualName,
    setManualName,
    manualModel,
    setManualModel,
    manualBrand,
    setManualBrand,
    manualCategory,
    setManualCategory,
    manualDescription,
    setManualDescription,
    manualDiscovering,
    handleManualAdd,
    handleManualRetry,
    openManual,
    tagPickerFor,
    setTagPickerFor,
    newTagName,
    setNewTagName,
    toggleTag,
    clearTags,
    handleCreateTag,
    handleAdd,
    handleDiscover,
  } = useCatalogSearch({
    reloadKey: open,
    focusOnLoad: false,
    onDiscovered: () => onClose(),
  });

  // Reset only on the closed→open transition. Running on every `open` render
  // (or after an unrelated re-render) could clear a query the user had already
  // typed, which also made the discovery tests flaky.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (justOpened) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <Modal open={open} onClose={onClose} title="Search Products">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setBulkOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700" aria-label="Bulk import">
            <Upload className="w-4 h-4" /> Bulk Import
          </button>
          <button onClick={() => openManual("")} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700" aria-label="Manual add">
            <PenLine className="w-4 h-4" /> Manual Add
          </button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) setRecentSearches(recordRecent(query)); }}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
            placeholder="Search by name, model, or brand..."
            aria-label="Search products by name, model, or brand"
          />
        </div>
        {query.length === 0 && recentSearches.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 items-center">
            <span className="text-xs text-gray-500">Recent:</span>
            {recentSearches.map((q) => (
              <button key={q} onClick={() => setQuery(q)} className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-xs hover:bg-gray-200 dark:hover:bg-gray-600">{q}</button>
            ))}
            <button onClick={() => { localStorage.removeItem(RECENT_KEY); setRecentSearches([]); }} className="text-xs text-gray-400 hover:text-gray-600 ml-1">Clear</button>
          </div>
        )}
        {discoveredProducts.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{discoveredProducts.length} discovered products included · up to 50</p>
        )}
        <div className="flex flex-col gap-2 mb-3">
          <PillFilterRow label="Category" options={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
          <PillFilterRow label="Brand" options={brands} selected={selectedBrand} onSelect={setSelectedBrand} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Sort</span>
            {CATALOG_SORT_OPTIONS.map((opt) => {
              const active = catalogSort === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setCatalogSort(opt.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                  aria-label={`Sort by ${opt.label}`}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
            {(selectedCategory || selectedBrand) && (
              <button onClick={() => { setSelectedCategory(null); setSelectedBrand(null); }} className="text-xs text-gray-500 ml-1">Clear</button>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500 mb-2">{sortedResults.length} result{sortedResults.length !== 1 ? "s" : ""}</div>
        <SearchModalResults
          results={sortedResults}
          trackedIds={trackedIds}
          pendingTags={pendingTags}
          tagDefinitions={tagDefinitions}
          query={query}
          discovering={discovering}
          discoverError={discoverError}
          onAssignTags={setTagPickerFor}
          onAdd={(product) => void handleAdd(product as (typeof PRODUCT_CATALOG)[number])}
          onDiscover={() => void handleDiscover()}
        />
        {toast && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium shadow-lg" role="alert">
            {toast}
          </div>
        )}
      </Modal>

      <TagPickerDialog
        open={tagPickerFor !== null}
        productId={tagPickerFor}
        tagDefinitions={tagDefinitions}
        pendingTags={pendingTags}
        newTagName={newTagName}
        onNewTagName={setNewTagName}
        onToggleTag={toggleTag}
        onCreateTag={() => void handleCreateTag()}
        onClear={clearTags}
        onClose={() => setTagPickerFor(null)}
      />

      <BulkImportDialog
        open={bulkOpen}
        text={bulkText}
        onTextChange={setBulkText}
        matchedCount={bulkPreview.matched.length}
        unmatched={bulkPreview.unmatched}
        newCount={bulkNew.length}
        importing={bulkImporting}
        onImport={handleBulkImport}
        onClose={() => setBulkOpen(false)}
      />

      <SearchModalManualAddDialog
        open={manualOpen}
        onClose={closeManualModal}
        manualTimedOut={manualTimedOut}
        manualRetrying={manualRetrying}
        manualProgress={manualProgress}
        manualName={manualName}
        onManualName={setManualName}
        manualModel={manualModel}
        onManualModel={setManualModel}
        manualBrand={manualBrand}
        onManualBrand={setManualBrand}
        manualCategory={manualCategory}
        onManualCategory={setManualCategory}
        manualDescription={manualDescription}
        onManualDescription={setManualDescription}
        manualDiscovering={manualDiscovering}
        brands={brands}
        categories={categories}
        onManualAdd={() => void handleManualAdd()}
        onManualRetry={() => void handleManualRetry()}
      />
    </>
  );
}
