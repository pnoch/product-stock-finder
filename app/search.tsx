import { log } from "@shared/log";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { goBackOrHome } from "@/lib/navigation";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";
import { useToast } from "@/components/ui/toast";

import { ScreenContainer } from "@/components/screen-container";
import { PaywallScreen } from "@/components/paywall/paywall-screen";
import { TagPickerSheet } from "@/components/tag-picker-sheet";
import { BulkImportModal } from "@/components/search/bulk-import-modal";
import { ManualAddSheet } from "@/components/search/manual-add-sheet";
import { FacebookResultsSection } from "@/components/search/facebook-results-section";
import { EbayResultsSection } from "@/components/search/ebay-results-section";
import { TrendingSection } from "@/components/home/trending-section";
import type { EbaySearchListing } from "@/shared/ebay-search";
import { useColors } from "@/hooks/use-colors";
import { useEntitlements } from "@/hooks/use-entitlements";
import { shouldEnforceFreeLimits } from "@/lib/pro-features";
import { track } from "@/lib/telemetry";
import { PRODUCT_CATALOG } from "@shared/catalog";
import { CatalogSearchBar } from "@/components/search/catalog-search-bar";
import { RecentSearches } from "@/components/search/recent-searches";
import { toDiscoverErrorState } from "@/lib/llm-discovery";
import {
  clearRecentSearches,
  getRecentSearches,
  recordSearch,
} from "@/lib/recent-searches";
import { SearchEmptyState } from "@/components/search/search-empty-state";
import { CatalogProductCard } from "@/components/search/catalog-product-card";
import { Product } from "@/lib/types";
import { useSearchData } from "@/hooks/use-search-data";
import { useCatalogSearch, type CatalogSort } from "@/hooks/use-catalog-search";
import { addCatalogProduct, discoverAndAddProduct } from "@/lib/add-product";
import { PillFilterRow } from "@/components/search/pill-filter-row";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TagFilterRow } from "@/components/tag-filter-row";
import { isEbayInput, isFacebookInput, isLazadaInput, isMarketplaceInput, isShopeeInput } from "@/shared/marketplace-url";

const CATALOG_SORT_OPTIONS: { key: CatalogSort; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "name", label: "Name" },
  { key: "brand", label: "Brand" },
  { key: "price", label: "Price" },
];

export default function SearchScreen({
  mode = "add",
  renderBrowse,
}: {
  mode?: "add" | "discover";
  renderBrowse?: (query: string) => ReactNode;
} = {}) {
  const router = useRouter();
  const colors = useColors();
  const { showToast } = useToast();
  const { isPro } = useEntitlements();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [pendingTags, setPendingTags] = useState<Record<string, string[]>>({});
  const [pickerItem, setPickerItem] = useState<Product | null>(null);
  const [postAddProduct, setPostAddProduct] = useState<Product | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [catalogSort, setCatalogSort] = useState<CatalogSort>("relevance");
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  useEffect(() => {
    void getRecentSearches().then(setRecentSearches);
  }, []);
  const [bulkVisible, setBulkVisible] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [manualPrefill, setManualPrefill] = useState<string | null>(null);
  const [ebayPrefill, setEbayPrefill] = useState<EbaySearchListing | null>(null);
  const {
    watchlist,
    trackedIds,
    tagDefinitions,
    selectedTagIds,
    setSelectedTagIds,
    tagMatchMode,
    setTagMatchMode,
    loadData,
  } = useSearchData();

  const handleSearchSubmit = useCallback(async () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    if (isMarketplaceInput(query)) setManualVisible(true);
    setRecentSearches(await recordSearch(query));
  }, [query]);

  const handleClearRecent = useCallback(async () => {
    await clearRecentSearches();
    setRecentSearches([]);
  }, []);

  async function handleDiscover() {
    if (!query.trim() || discovering) return;
    if (isMarketplaceInput(query)) {
      setManualVisible(true);
      return;
    }
    Keyboard.dismiss();
    setDiscovering(true);
    try {
      const result = await discoverAndAddProduct(query, { isPro });
      if (result.status === "duplicate") {
        showAlert(
          "Already tracked",
          `"${result.product.name}" is already in your watchlist.`,
        );
        router.push(`/product/${result.product.id}`);
        return;
      }
      if (result.status === "paywall") {
        track("paywall_shown");
        setPaywallVisible(true);
        return;
      }
      if (result.status === "not_found") {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert(
          "Discovery Failed",
          "We couldn't find that product. Try a more specific model number or brand name.",
        );
        return;
      }
      track("product_added", { productId: result.product.id });
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(
        result.discovered > 0
          ? `Added ${result.product.name} — prices at ${result.discovered} distributor${result.discovered === 1 ? "" : "s"}`
          : `Added ${result.product.name} — no prices yet`,
        "success",
      );
      router.push(`/product/${result.product.id}`);
    } catch (e) {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Single source of truth for discovery error copy (also used by desktop),
      // including a rejected BYO-LLM key ("Check your API key").
      const state = toDiscoverErrorState(e);
      showAlert(
        state.title,
        state.message,
        state.retry
          ? [
              { text: "Retry", onPress: () => void handleDiscover() },
              { text: "Cancel", style: "cancel" },
            ]
          : [{ text: "OK" }],
      );
    } finally {
      setDiscovering(false);
    }
  }

  const {
    deferredQuery,
    refreshDiscovered,
    tagCounts,
    categories,
    brands,
    sortedResults,
  } = useCatalogSearch({
    query,
    watchlist,
    trackedIds,
    selectedTagIds,
    tagMatchMode,
    selectedCategory,
    selectedBrand,
    catalogSort,
  });

  const handleManualAdded = useCallback(() => {
    loadData();
    void refreshDiscovered();
  }, [loadData, refreshDiscovered]);

  const handleAdd = useCallback(
    async (item: (typeof PRODUCT_CATALOG)[0]) => {
      if (adding) return;
      if (trackedIds.has(item.id)) {
        showAlert(
          "Already Tracked",
          `"${item.name}" is already in your watchlist.`,
        );
        return;
      }
      setAdding(item.id);
      Keyboard.dismiss();
      const pending = pendingTags[item.id] ?? [];
      try {
        const result = await addCatalogProduct(item, {
          tags: pending,
          isPro,
        });
        if (result.status === "duplicate") {
          showAlert(
            "Already tracked",
            `"${item.name}" is already in your watchlist.`,
          );
          return;
        }
        if (result.status === "paywall") {
          track("paywall_shown");
          setPaywallVisible(true);
          return;
        }
        if (result.status === "not_found") return;
        track("product_added", { productId: item.id });
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        loadData();
        setPendingTags((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        showToast(
          result.discovered > 0
            ? `Added ${item.name} — prices at ${result.discovered} distributor${result.discovered === 1 ? "" : "s"}`
            : `Added ${item.name} — no prices yet`,
          "success",
        );
        if (pending.length > 0) {
          setPostAddProduct(result.product);
        } else {
          goBackOrHome(router, "/(tabs)/watchlist");
        }
      } catch (e) {
        log.error("[Search] addToWatchlist failed", e);
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert(
          "Couldn't add product",
          "We couldn't add this product to your watchlist. Please check your connection and try again.",
        );
      } finally {
        setAdding(null);
      }
    },
    [router, trackedIds, adding, pendingTags, loadData, showToast, isPro],
  );

  const handleTagPress = useCallback((p: Product) => {
    setPickerItem({
      ...p,
      addedAt: new Date().toISOString(),
      isWatched: false,
      listings: [],
      tags: pendingTags[p.id] ?? [],
    });
  }, [pendingTags]);

  return (
    <ScreenContainer>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 12,
          gap: 12,
        }}
      >
        {mode === "add" && <TouchableOpacity activeOpacity={0.7} onPress={() => goBackOrHome(router)} accessibilityLabel="Go back" accessibilityRole="button" style={{ padding: 4 }} hitSlop={12}>
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </TouchableOpacity>}
        <Text
          style={{
            color: colors.foreground,
            fontSize: mode === "discover" ? 28 : 20,
            fontWeight: "700",
            flex: 1,
          }}
        >
          {mode === "discover" ? "Discover" : "Add Product"}
        </Text>
        <TouchableOpacity activeOpacity={0.7}
          accessibilityLabel="Add product manually or import marketplace link"
          accessibilityRole="button"
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setEbayPrefill(null);
            setManualPrefill(null);
            setManualVisible(true);
          }}
          style={{ padding: 4 }}
          hitSlop={12}
        >
          <IconSymbol name="wand.and.stars" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7}
          accessibilityLabel="Bulk import products"
          accessibilityRole="button"
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (shouldEnforceFreeLimits() && !isPro) {
              track("paywall_shown");
              setPaywallVisible(true);
              return;
            }
            setBulkVisible(true);
          }}
          style={{ padding: 4 }}
          hitSlop={12}
        >
          <IconSymbol
            name="square.and.arrow.down"
            size={22}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

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
            {(mode === "add" || !!query.trim()) && <View>
            {query.length === 0 && (
              <RecentSearches
                searches={recentSearches}
                onSelect={(q) => setQuery(q)}
                onClear={handleClearRecent}
              />
            )}

            {Object.keys(tagDefinitions).length > 0 && (
              <TagFilterRow
                tagDefinitions={tagDefinitions}
                selectedTagIds={selectedTagIds}
                tagMatchMode={tagMatchMode}
                counts={tagCounts}
                onToggleTag={(tagId) =>
                  setSelectedTagIds((prev) =>
                    prev.includes(tagId)
                      ? prev.filter((t) => t !== tagId)
                      : [...prev, tagId],
                  )
                }
                onChangeMode={setTagMatchMode}
                onClearAll={() => setSelectedTagIds([])}
              />
            )}

            {/* Category / Brand filters — collapsed behind a toggle while
                searching so the ~40 chips don't push results below the fold. */}
            {query.trim().length > 0 && !filtersExpanded ? (
              <TouchableOpacity
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Show filters"
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFiltersExpanded(true);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingBottom: 10 }}
              >
                <IconSymbol name="slider.horizontal.3" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                  Filters{(selectedCategory || selectedBrand) ? " · active" : ""}
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <PillFilterRow label="Category" options={categories} selected={selectedCategory} onSelect={setSelectedCategory} colors={colors} />
                <PillFilterRow label="Brand" options={brands} selected={selectedBrand} onSelect={setSelectedBrand} colors={colors} />
                {query.trim().length > 0 && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Hide filters"
                    onPress={() => setFiltersExpanded(false)}
                    style={{ paddingHorizontal: 16, paddingBottom: 10 }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Hide filters</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Catalog sort bar — parity with watchlist SortGroupBar */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 10, flexWrap: "wrap" }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>Sort</Text>
              {CATALOG_SORT_OPTIONS.map((opt) => {
                const active = catalogSort === opt.key;
                return (
                  <TouchableOpacity activeOpacity={0.85}
                    key={opt.key}
                    onPress={() => {
                      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCatalogSort(opt.key);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={{ color: active ? "#fff" : colors.muted, fontSize: 13, fontWeight: "600" }}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {(selectedCategory || selectedBrand) && (
                <TouchableOpacity activeOpacity={0.7} onPress={() => { setSelectedCategory(null); setSelectedBrand(null); }} style={{ padding: 4 }} accessibilityLabel="Clear category/brand filter" accessibilityRole="button">
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {selectedTagIds.length > 0 && (
              <View
                style={{
                  marginHorizontal: 16,
                  marginBottom: 12,
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: colors.primary + "14",
                  borderWidth: 1,
                  borderColor: colors.primary + "33",
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Tag filter: showing watchlist matches only — clear to see catalog
                </Text>
              </View>
            )}

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

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, paddingHorizontal: 16 }}>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                {query.trim()
                  ? `${sortedResults.length} catalog result${sortedResults.length !== 1 ? "s" : ""}`
                  : "All Products"}
              </Text>
              {query.trim().length > 0 && sortedResults.length > 0 && (
                <View style={{ backgroundColor: colors.primary + "14", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>{sortedResults.length}</Text>
                </View>
              )}
            </View>
            </View>}
          </View>
        }
        ListEmptyComponent={mode === "discover" && !query.trim() ? undefined : <SearchEmptyState query={query} selectedTagIds={selectedTagIds} hasMarketplaceResults={query.trim().length >= 2} />}
        ListFooterComponent={
          query.trim().length > 0 ? (
            <View style={{ paddingHorizontal: 16 }}>
              {discovering ? (
                <View style={{ alignItems: "center", padding: 24 }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ color: colors.muted, marginTop: 8 }}>
                    Discovering product...
                  </Text>
                </View>
              ) : (
                <TouchableOpacity activeOpacity={0.85}
                  accessibilityLabel={isFacebookInput(query) ? "Import Facebook link" : isLazadaInput(query) ? "Import Lazada link" : isShopeeInput(query) ? "Import Shopee link" : isEbayInput(query) ? "Import eBay link" : "Discover with AI"}
                  accessibilityRole="button"
                  onPress={handleDiscover}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: 16,
                    marginTop: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.primary + "44",
                    backgroundColor: colors.primary + "11",
                  }}
                >
                  <IconSymbol
                    name="wand.and.stars"
                    size={20}
                    color={colors.primary}
                  />
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: "600",
                      fontSize: 14,
                    }}
                  >
                    {isFacebookInput(query) ? "Import Facebook Link" : isLazadaInput(query) ? "Import Lazada Link" : isShopeeInput(query) ? "Import Shopee Link" : isEbayInput(query) ? "Import eBay Link" : "Discover with AI"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : undefined
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
