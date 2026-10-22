import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { PRODUCT_CATALOG } from "@shared/catalog";
import { storage } from "../storage";
import { discoverProduct, toDiscoverErrorState } from "../../../lib/llm-discovery";
import { nextTagColor } from "../../../lib/tags";
import { useToast } from "../hooks/use-toast";
import { useSearchData } from "../hooks/use-search-data";
import { useBulkImport } from "../hooks/use-bulk-import";
import { useManualAdd } from "../hooks/use-manual-add";
import { TagPickerDialog } from "../components/search/TagPickerDialog";
import { BulkImportDialog } from "../components/search/BulkImportDialog";
import { ManualAddDialog } from "../components/search/ManualAddDialog";
import { SearchResults } from "../components/search/SearchResults";
import { SearchHeader } from "../components/search/SearchHeader";
import { SearchFilters } from "../components/search/SearchFilters";

import { RECENT_KEY, recordRecent, type CatalogSort } from "../components/search-chrome";

export function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tagPickerFor, setTagPickerFor] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<{ title: string; message: string; retry: boolean } | null>(null);
  const { toast, showToast } = useToast();
  const [searchTagIds, setSearchTagIds] = useState<string[]>([]);
  const [searchTagMode, setSearchTagMode] = useState<"any" | "all">("any");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [catalogSort, setCatalogSort] = useState<CatalogSort>("relevance");

  const {
    trackedIds,
    setTrackedIds,
    discoveredProducts,
    recentSearches,
    setRecentSearches,
    tagDefinitions,
    setTagDefinitions,
    pendingTags,
    setPendingTags,
    inputRef,
    tagCounts,
    categories,
    brands,
    sortedResults,
  } = useSearchData({
    query,
    searchTagIds,
    searchTagMode,
    selectedCategory,
    selectedBrand,
    catalogSort,
  });

  const handleAdd = async (product: (typeof PRODUCT_CATALOG)[number]) => {
    const tags = pendingTags[product.id] ?? [];
    try {
      await storage.addToWatchlist({ ...product, addedAt: new Date().toISOString(), isWatched: true, listings: [], tags });
      if (tags.length) setPendingTags((prev) => { const n = { ...prev }; delete n[product.id]; return n; });
      setTrackedIds((prev) => new Set([...prev, product.id]));
      showToast(`Added ${product.name}`);
      navigate("/watchlist");
      if (query.trim()) setRecentSearches(recordRecent(query));
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed"); }
  };

  const handleDiscover = useCallback(async () => {
    if (!query.trim() || discovering) return;
    setDiscovering(true);
    setDiscoverError(null);
    try {
      const res = await discoverProduct(query, storage);
      if (res) {
        await storage.addToWatchlist({ ...res.product, addedAt: new Date().toISOString(), isWatched: true, listings: [], tags: [] });
        // Mark it tracked so the catalog row stops offering "Add" (mobile
        // reloads trackedIds via loadData()).
        setTrackedIds((prev) => new Set([...prev, res.product.id]));
        setRecentSearches(recordRecent(query));
        navigate(`/product/${res.product.id}`);
      } else { showToast("Discovery failed"); }
    } catch (e) {
      const errState = toDiscoverErrorState(e);
      setDiscoverError(errState);
      showToast(errState.title);
    } finally { setDiscovering(false); }
  }, [query, discovering, navigate, showToast, setTrackedIds, setRecentSearches]);

  const handleCreateTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name || !tagPickerFor) return;
    try {
      const current = await storage.getTagDefinitions();
      const tag = await storage.createTag(name, nextTagColor(current));
      setTagDefinitions({ ...current, [tag.id]: tag });
      setPendingTags((prev) => ({
        ...prev,
        [tagPickerFor]: [...(prev[tagPickerFor] ?? []), tag.id],
      }));
      setNewTagName("");
    } catch {
      showToast("Couldn't create tag");
    }
  }, [newTagName, tagPickerFor, showToast, setTagDefinitions, setPendingTags]);

  const {
    bulkOpen,
    setBulkOpen,
    bulkText,
    setBulkText,
    bulkImporting,
    bulkPreview,
    bulkNew,
    handleBulkImport,
  } = useBulkImport({ trackedIds, setTrackedIds, showToast });

  const {
    manualOpen,
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
    pasteText,
    setPasteText,
    urlInput,
    setUrlInput,
    urlParsing,
    manualParsing,
    manualDiscovering,
    manualProgress,
    manualTimedOut,
    manualRetrying,
    manualError,
    handleManualParse,
    handleUrlFetch,
    handleManualAdd,
    handleManualRetry,
    openManual,
    closeManualModal,
  } = useManualAdd({ categories, trackedIds, setTrackedIds, showToast });

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <SearchHeader
        query={query}
        onQuery={setQuery}
        recentSearches={recentSearches}
        onRecent={setQuery}
        onClearRecent={() => {
          localStorage.removeItem(RECENT_KEY);
          setRecentSearches([]);
        }}
        onBulkOpen={() => setBulkOpen(true)}
        onManualOpen={() => openManual(query)}
        inputRef={inputRef}
        onEnter={() => setRecentSearches(recordRecent(query))}
        discoveredCount={discoveredProducts.length}
      />

      <SearchFilters
        tagDefinitions={tagDefinitions}
        searchTagIds={searchTagIds}
        searchTagMode={searchTagMode}
        tagCounts={tagCounts}
        onToggleTag={(id) =>
          setSearchTagIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
          )
        }
        onChangeTagMode={setSearchTagMode}
        onClearTags={() => setSearchTagIds([])}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        brands={brands}
        selectedBrand={selectedBrand}
        onSelectBrand={setSelectedBrand}
        catalogSort={catalogSort}
        onCatalogSort={setCatalogSort}
        resultCount={sortedResults.length}
        query={query}
      />

      <SearchResults
        results={sortedResults}
        trackedIds={trackedIds}
        pendingTags={pendingTags}
        tagDefinitions={tagDefinitions}
        query={query}
        searchTagIds={searchTagIds}
        discovering={discovering}
        discoverError={discoverError}
        onOpen={(productId) => navigate(`/product/${productId}`)}
        onAdd={(product) => void handleAdd(product)}
        onAssignTags={setTagPickerFor}
        onDiscover={() => void handleDiscover()}
      />

      {toast && <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm shadow-lg">{toast}</div>}

      <TagPickerDialog
        open={tagPickerFor !== null}
        productId={tagPickerFor}
        tagDefinitions={tagDefinitions}
        pendingTags={pendingTags}
        newTagName={newTagName}
        onNewTagName={setNewTagName}
        onToggleTag={(tagId) => {
          if (!tagPickerFor) return;
          setPendingTags((prev) => {
            const cur = prev[tagPickerFor] ?? [];
            const nxt = cur.includes(tagId)
              ? cur.filter((id) => id !== tagId)
              : [...cur, tagId];
            return { ...prev, [tagPickerFor]: nxt };
          });
        }}
        onCreateTag={() => void handleCreateTag()}
        onClear={() => {
          if (!tagPickerFor) return;
          setPendingTags((p) => {
            const n = { ...p };
            delete n[tagPickerFor];
            return n;
          });
          setTagPickerFor(null);
        }}
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
      <ManualAddDialog
        open={manualOpen}
        pasteText={pasteText}
        onPasteText={setPasteText}
        urlInput={urlInput}
        onUrlInput={setUrlInput}
        urlParsing={urlParsing}
        manualParsing={manualParsing}
        manualError={manualError}
        manualProgress={manualProgress}
        manualTimedOut={manualTimedOut}
        manualRetrying={manualRetrying}
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
        onManualParse={() => void handleManualParse()}
        onUrlFetch={() => void handleUrlFetch()}
        onManualAdd={() => void handleManualAdd()}
        onManualRetry={() => void handleManualRetry()}
        onClose={closeManualModal}
      />
    </div>
  );
}
