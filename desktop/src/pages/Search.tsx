import { useNavigate } from "react-router";
import { useCatalogSearch } from "../hooks/use-catalog-search";
import { TagPickerDialog } from "../components/search/TagPickerDialog";
import { BulkImportDialog } from "../components/search/BulkImportDialog";
import { ManualAddDialog } from "../components/search/ManualAddDialog";
import { SearchResults } from "../components/search/SearchResults";
import { SearchHeader } from "../components/search/SearchHeader";
import { SearchFilters } from "../components/search/SearchFilters";
import { RECENT_KEY, recordRecent } from "../components/search-chrome";

export function Search() {
  const navigate = useNavigate();
  const search = useCatalogSearch({
    onAdded: () => navigate("/watchlist"),
    onDiscovered: (productId) => navigate(`/product/${productId}`),
  });

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <SearchHeader
        query={search.query}
        onQuery={search.setQuery}
        recentSearches={search.recentSearches}
        onRecent={search.setQuery}
        onClearRecent={() => {
          localStorage.removeItem(RECENT_KEY);
          search.setRecentSearches([]);
        }}
        onBulkOpen={() => search.setBulkOpen(true)}
        onManualOpen={() => search.openManual(search.query)}
        inputRef={search.inputRef}
        onEnter={() => search.setRecentSearches(recordRecent(search.query))}
        discoveredCount={search.discoveredProducts.length}
      />

      <SearchFilters
        tagDefinitions={search.tagDefinitions}
        searchTagIds={search.searchTagIds}
        searchTagMode={search.searchTagMode}
        tagCounts={search.tagCounts}
        onToggleTag={(id) =>
          search.setSearchTagIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
          )
        }
        onChangeTagMode={search.setSearchTagMode}
        onClearTags={() => search.setSearchTagIds([])}
        categories={search.categories}
        selectedCategory={search.selectedCategory}
        onSelectCategory={search.setSelectedCategory}
        brands={search.brands}
        selectedBrand={search.selectedBrand}
        onSelectBrand={search.setSelectedBrand}
        catalogSort={search.catalogSort}
        onCatalogSort={search.setCatalogSort}
        resultCount={search.sortedResults.length}
        query={search.query}
      />

      <SearchResults
        results={search.sortedResults}
        trackedIds={search.trackedIds}
        pendingTags={search.pendingTags}
        tagDefinitions={search.tagDefinitions}
        query={search.query}
        searchTagIds={search.searchTagIds}
        discovering={search.discovering}
        discoverError={search.discoverError}
        onOpen={(productId) => navigate(`/product/${productId}`)}
        onAdd={(product) => void search.handleAdd(product)}
        onAssignTags={search.setTagPickerFor}
        onDiscover={() => void search.handleDiscover()}
      />

      {search.toast && (
        <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          {search.toast}
        </div>
      )}

      <TagPickerDialog
        open={search.tagPickerFor !== null}
        productId={search.tagPickerFor}
        tagDefinitions={search.tagDefinitions}
        pendingTags={search.pendingTags}
        newTagName={search.newTagName}
        onNewTagName={search.setNewTagName}
        onToggleTag={search.toggleTag}
        onCreateTag={() => void search.handleCreateTag()}
        onClear={search.clearTags}
        onClose={() => search.setTagPickerFor(null)}
      />

      <BulkImportDialog
        open={search.bulkOpen}
        text={search.bulkText}
        onTextChange={search.setBulkText}
        matchedCount={search.bulkPreview.matched.length}
        unmatched={search.bulkPreview.unmatched}
        newCount={search.bulkNew.length}
        importing={search.bulkImporting}
        onImport={search.handleBulkImport}
        onClose={() => search.setBulkOpen(false)}
      />

      <ManualAddDialog
        open={search.manualOpen}
        pasteText={search.pasteText}
        onPasteText={search.setPasteText}
        urlInput={search.urlInput}
        onUrlInput={search.setUrlInput}
        urlParsing={search.urlParsing}
        manualParsing={search.manualParsing}
        manualError={search.manualError}
        manualProgress={search.manualProgress}
        manualTimedOut={search.manualTimedOut}
        manualRetrying={search.manualRetrying}
        manualName={search.manualName}
        onManualName={search.setManualName}
        manualModel={search.manualModel}
        onManualModel={search.setManualModel}
        manualBrand={search.manualBrand}
        onManualBrand={search.setManualBrand}
        manualCategory={search.manualCategory}
        onManualCategory={search.setManualCategory}
        manualDescription={search.manualDescription}
        onManualDescription={search.setManualDescription}
        manualDiscovering={search.manualDiscovering}
        brands={search.brands}
        categories={search.categories}
        onManualParse={() => void search.handleManualParse()}
        onUrlFetch={() => void search.handleUrlFetch()}
        onManualAdd={() => void search.handleManualAdd()}
        onManualRetry={() => void search.handleManualRetry()}
        onClose={search.closeManualModal}
      />
    </div>
  );
}
