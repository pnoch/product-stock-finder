import { type ReactNode } from "react";
import { FlatList, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { goBackOrHome } from "@/lib/navigation";
import { shouldEnforceFreeLimits } from "@/lib/pro-features";
import { track } from "@/lib/telemetry";
import type { Product } from "@/lib/types";
import { PaywallScreen } from "@/components/paywall/paywall-screen";
import { TagPickerSheet } from "@/components/tag-picker-sheet";
import { BulkImportModal } from "@/components/search/bulk-import-modal";
import { ManualAddSheet } from "@/components/search/manual-add-sheet";
import { FacebookResultsSection } from "@/components/search/facebook-results-section";
import { EbayResultsSection } from "@/components/search/ebay-results-section";
import { TrendingSection } from "@/components/home/trending-section";
import { CatalogSearchBar } from "@/components/search/catalog-search-bar";
import { SearchEmptyState } from "@/components/search/search-empty-state";
import { CatalogProductCard } from "@/components/search/catalog-product-card";
import { SearchHeader } from "@/components/search/search-header";
import { SearchDiscoverFooter } from "@/components/search/search-discover-footer";
import { SearchListHeader } from "@/components/search/search-list-header";
import { useSearchScreen } from "@/hooks/use-search-screen";

export default function SearchScreen({
  mode = "add",
  renderBrowse,
}: {
  mode?: "add" | "discover";
  renderBrowse?: (query: string) => ReactNode;
} = {}) {
  const screen = useSearchScreen();
  const {
    router,
    isPro,
    paywallVisible,
    setPaywallVisible,
    query,
    setQuery,
    adding,
    discovering,
    setPendingTags,
    pickerItem,
    setPickerItem,
    postAddProduct,
    setPostAddProduct,
    recentSearches,
    selectedCategory,
    setSelectedCategory,
    selectedBrand,
    setSelectedBrand,
    catalogSort,
    setCatalogSort,
    filtersExpanded,
    setFiltersExpanded,
    bulkVisible,
    setBulkVisible,
    manualVisible,
    setManualVisible,
    manualPrefill,
    setManualPrefill,
    ebayPrefill,
    setEbayPrefill,
    trackedIds,
    tagDefinitions,
    selectedTagIds,
    setSelectedTagIds,
    tagMatchMode,
    setTagMatchMode,
    loadData,
    handleSearchSubmit,
    handleClearRecent,
    handleDiscover,
    handleManualAdded,
    handleAdd,
    handleTagPress,
    catalog,
  } = screen;
  const {
    deferredQuery,
    tagCounts,
    categories,
    brands,
    sortedResults,
  } = catalog;

  return (
    <ScreenContainer>
      <SearchHeader
        mode={mode}
        onBack={() => goBackOrHome(router)}
        onManualAdd={() => {
          setEbayPrefill(null);
          setManualPrefill(null);
          setManualVisible(true);
        }}
        onBulkImport={() => {
          if (shouldEnforceFreeLimits() && !isPro) {
            track("paywall_shown");
            setPaywallVisible(true);
            return;
          }
          setBulkVisible(true);
        }}
      />

      {/* Search Bar */}
      <CatalogSearchBar
        query={query}
        onQueryChange={setQuery}
        onSearchSubmit={handleSearchSubmit}
      />

      {/* Results. The filter chrome lives in the list's ListHeaderComponent so it
          scrolls away with the content (QA round 16: as flex siblings the tag
          chips + category/brand pill rows + sort bar consumed the whole screen
          and squeezed the results list into a ~324px strip at the bottom). */}
      <FlatList showsVerticalScrollIndicator={true}
        style={{ flex: 1 }}
        data={mode === "discover" && !query.trim() ? [] : sortedResults}
        keyExtractor={(item) => item.id}
        initialNumToRender={10}
        windowSize={5}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View>
            {renderBrowse?.(query)}
            <SearchListHeader
              mode={mode}
              query={query}
              recentSearches={recentSearches}
              onSelectRecent={setQuery}
              onClearRecent={handleClearRecent}
              tagDefinitions={tagDefinitions}
              selectedTagIds={selectedTagIds}
              tagMatchMode={tagMatchMode}
              tagCounts={tagCounts}
              onToggleTag={(tagId) =>
                setSelectedTagIds((prev) =>
                  prev.includes(tagId)
                    ? prev.filter((t) => t !== tagId)
                    : [...prev, tagId],
                )
              }
              onChangeTagMode={setTagMatchMode}
              onClearTags={() => setSelectedTagIds([])}
              categories={categories}
              brands={brands}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              selectedBrand={selectedBrand}
              onBrandChange={setSelectedBrand}
              catalogSort={catalogSort}
              onSortChange={setCatalogSort}
              filtersExpanded={filtersExpanded}
              onShowFilters={() => setFiltersExpanded(true)}
              onHideFilters={() => setFiltersExpanded(false)}
              resultCount={sortedResults.length}
            />

            <FacebookResultsSection
              query={deferredQuery}
              onTrack={(url) => {
                setEbayPrefill(null);
                setManualPrefill(url);
                setManualVisible(true);
              }}
            />

            <EbayResultsSection query={deferredQuery} onTrack={(listing) => {
              setEbayPrefill(listing);
              setManualPrefill(listing.url);
              setManualVisible(true);
            }} />

            {query.trim().length > 0 && (
              <View style={{ paddingHorizontal: 16 }}>
                <TrendingSection query={deferredQuery} />
              </View>
            )}

          </View>
        }
        ListEmptyComponent={mode === "discover" && !query.trim() ? undefined : <SearchEmptyState query={query} selectedTagIds={selectedTagIds} hasMarketplaceResults={query.trim().length >= 2} />}
        ListFooterComponent={
          <SearchDiscoverFooter
            query={query}
            discovering={discovering}
            onDiscover={handleDiscover}
          />
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <CatalogProductCard
              product={item as Product}
              isTracked={trackedIds.has(item.id)}
              isAdding={adding === item.id}
              onAdd={handleAdd}
              onTagPress={handleTagPress}
              onOpen={(p) => router.push(`/product/${p.id}`)}
            />
          </View>
        )}
      />

      {pickerItem && (
        <TagPickerSheet
          visible={!!pickerItem}
          product={pickerItem}
          onClose={() => setPickerItem(null)}
          onChanged={() => {
            loadData();
          }}
          onApply={(tagIds) => {
            if (!pickerItem) return;
            setPendingTags((prev) => ({ ...prev, [pickerItem.id]: tagIds }));
            setPickerItem(null);
          }}
        />
      )}

      {postAddProduct && (
        <TagPickerSheet
          visible={!!postAddProduct}
          product={postAddProduct}
          onClose={() => {
            setPostAddProduct(null);
            goBackOrHome(router, "/(tabs)/watchlist");
          }}
          onChanged={() => {
            loadData();
          }}
        />
      )}

      <BulkImportModal
        visible={bulkVisible}
        onClose={() => setBulkVisible(false)}
        trackedIds={trackedIds}
        onImported={loadData}
      />

      <ManualAddSheet
        visible={manualVisible}
        onClose={() => {
          setManualVisible(false);
          setManualPrefill(null);
        }}
        initialText={manualPrefill ?? query}
        initialEbayListing={ebayPrefill ?? undefined}
        trackedIds={trackedIds}
        onAdded={handleManualAdded}
      />

      <PaywallScreen
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
    </ScreenContainer>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
