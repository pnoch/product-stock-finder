import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
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
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";
import { useToast } from "@/components/ui/toast";

import { ScreenContainer } from "@/components/screen-container";
import { TagPickerSheet } from "@/components/tag-picker-sheet";
import { BulkImportModal } from "@/components/search/bulk-import-modal";
import { ManualAddSheet } from "@/components/search/manual-add-sheet";
import { useColors } from "@/hooks/use-colors";
import { searchCatalog, getAllCatalog, PRODUCT_CATALOG } from "@/lib/catalog";
import { CatalogSearchBar } from "@/components/search/catalog-search-bar";
import { RecentSearches } from "@/components/search/recent-searches";
import {
  clearRecentSearches,
  getRecentSearches,
  recordSearch,
} from "@/lib/recent-searches";
import { SearchEmptyState } from "@/components/search/search-empty-state";
import { CatalogProductCard } from "@/components/search/catalog-product-card";
import { addToWatchlist } from "@/lib/storage";
import { Product } from "@/lib/types";
import { discoverProduct } from "@/lib/llm-discovery";
import { useSearchData } from "@/hooks/use-search-data";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TagFilterRow } from "@/components/tag-filter-row";
import { countTagMatchesByIds, filterWatchlist } from "@/lib/watchlist-org";

export default function SearchScreen() {
  const router = useRouter();
  const colors = useColors();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [pendingTags, setPendingTags] = useState<Record<string, string[]>>({});
  const [pickerItem, setPickerItem] = useState<Product | null>(null);
  const [postAddProduct, setPostAddProduct] = useState<Product | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    void getRecentSearches().then(setRecentSearches);
  }, []);
  const [bulkVisible, setBulkVisible] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
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
    setRecentSearches(await recordSearch(query));
  }, [query]);

  const handleClearRecent = useCallback(async () => {
    await clearRecentSearches();
    setRecentSearches([]);
  }, []);

  const handleDiscover = useCallback(async () => {
    if (!query.trim() || discovering) return;
    Keyboard.dismiss();
    setDiscovering(true);
    try {
      const result = await discoverProduct(query);
      if (result) {
        loadData();
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(`Added ${result.product.name} to watchlist`, "success");
        router.push(`/product/${result.product.id}`);
      } else {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert(
          "Discovery Failed",
          "We couldn't find that product. Try a more specific model number or brand name.",
        );
      }
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Discovery Failed", "We couldn't find that product. Try again.");
    } finally {
      setDiscovering(false);
    }
  }, [query, discovering, loadData, router, showToast]);

  const deferredQuery = useDeferredValue(query);
  const [discoveredProducts, setDiscoveredProducts] = useState<
    (typeof PRODUCT_CATALOG)[0][]
  >([]);

  useEffect(() => {
    let active = true;
    void getAllCatalog().then((all) => {
      if (!active) return;
      const staticIds = new Set(PRODUCT_CATALOG.map((p) => p.id));
      setDiscoveredProducts(all.filter((p) => !staticIds.has(p.id)));
    });
    return () => {
      active = false;
    };
  }, [watchlist]);

  const results = useMemo(() => {
    const staticResults =
      deferredQuery.trim().length > 0
        ? searchCatalog(deferredQuery)
        : PRODUCT_CATALOG;
    const q = deferredQuery.trim().toLowerCase();
    const matchingDiscovered = q
      ? discoveredProducts.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.modelNumber.toLowerCase().includes(q),
        )
      : discoveredProducts;
    return [...staticResults, ...matchingDiscovered];
  }, [deferredQuery, discoveredProducts]);

  const tagFilteredIds = useMemo(() => {
    const matching = filterWatchlist(watchlist, {
      region: "all",
      status: "all",
      query: "",
      tagIds: selectedTagIds,
      tagMatchMode,
    });
    return new Set(matching.map((p) => p.id));
  }, [watchlist, selectedTagIds, tagMatchMode]);

  const tagFilteredResults = useMemo(() => {
    if (selectedTagIds.length === 0) return results;
    return results.filter((product) => tagFilteredIds.has(product.id));
  }, [results, selectedTagIds, tagFilteredIds]);

  const tagCounts = useMemo(() => {
    const resultIds = new Set(results.map((p) => p.id));
    return countTagMatchesByIds(watchlist, resultIds);
  }, [watchlist, results]);

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
      const product: Product = {
        ...item,
        addedAt: new Date().toISOString(),
        isWatched: true,
        listings: [],
        tags: pending,
      };
      try {
        await addToWatchlist(product);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        loadData();
        setPendingTags((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        showToast(`Added ${item.name} to watchlist`, "success");
        if (pending.length > 0) {
          setPostAddProduct(product);
        } else {
          router.back();
        }
      } catch (e) {
        console.error("[Search] addToWatchlist failed", e);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert("Couldn't add product", "We couldn't add this product to your watchlist. Please check your connection and try again.");
      } finally {
        setAdding(null);
      }
    },
    [router, trackedIds, adding, pendingTags, loadData, showToast],
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
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} accessibilityLabel="Go back" accessibilityRole="button" style={{ padding: 4 }} hitSlop={12}>
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 20,
            fontWeight: "700",
            flex: 1,
          }}
        >
          Add Product
        </Text>
        <TouchableOpacity activeOpacity={0.7}
          accessibilityLabel="Add product manually"
          accessibilityRole="button"
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

      {/* Results */}
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
            Showing watchlist matches for selected tags — clear tag filter to
            see full catalog
          </Text>
        </View>
      )}
      <FlatList showsVerticalScrollIndicator={true}
        data={tagFilteredResults}
        keyExtractor={(item) => item.id}
        initialNumToRender={10}
        windowSize={5}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
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
                ? `${tagFilteredResults.length} result${tagFilteredResults.length !== 1 ? "s" : ""}`
                : "All Products"}
            </Text>
            {query.trim().length > 0 && tagFilteredResults.length > 0 && (
              <View style={{ backgroundColor: colors.primary + "14", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>{tagFilteredResults.length}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View>
            <SearchEmptyState query={query} selectedTagIds={selectedTagIds} />
            {query.trim().length > 0 && !discovering && (
              <TouchableOpacity activeOpacity={0.85}
                accessibilityLabel="Discover with AI"
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
                  Discover with AI
                </Text>
              </TouchableOpacity>
            )}
            {discovering && (
              <View style={{ alignItems: "center", padding: 24 }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.muted, marginTop: 8 }}>
                  Discovering product...
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <CatalogProductCard
            product={item as Product}
            isTracked={trackedIds.has(item.id)}
            isAdding={adding === item.id}
            onAdd={handleAdd}
            onTagPress={handleTagPress}
          />
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
            router.back();
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
        onClose={() => setManualVisible(false)}
        initialText={query}
        trackedIds={trackedIds}
        onAdded={loadData}
      />
    </ScreenContainer>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
