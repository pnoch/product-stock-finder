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
import { searchCatalog, getAllCatalog, PRODUCT_CATALOG, getAllCategories, getAllBrands } from "@shared/catalog";
import { SAMPLE_LISTINGS } from "@/lib/sample-data";
import { CatalogSearchBar } from "@/components/search/catalog-search-bar";
import { RecentSearches } from "@/components/search/recent-searches";
import { DiscoveryAuthError, DiscoveryError, discoverProduct } from "@/lib/llm-discovery";
import {
  clearRecentSearches,
  getRecentSearches,
  recordSearch,
} from "@/lib/recent-searches";
import { SearchEmptyState } from "@/components/search/search-empty-state";
import { CatalogProductCard } from "@/components/search/catalog-product-card";
import { addToWatchlist } from "@/lib/storage";
import { Product } from "@/lib/types";
import { useSearchData } from "@/hooks/use-search-data";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TagFilterRow } from "@/components/tag-filter-row";
import { countTagMatches, filterWatchlist } from "@/lib/watchlist-org";
import Fuse from "fuse.js";

const PREVIEW_LIMIT = 10;

function previewStockScore(productId: string): number {
  const listings = SAMPLE_LISTINGS[productId] ?? [];
  if (listings.length === 0) return 0;
  const inStock = listings.filter((l) => l.stockStatus === "in_stock").length;
  // Weight in-stock heavily, then total listings
  return inStock * 10 + listings.length;
}

function sortPreviewByStock<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => previewStockScore(b.id) - previewStockScore(a.id));
}

type CatalogSort = "relevance" | "name" | "price" | "brand";

const CATALOG_SORT_OPTIONS: { key: CatalogSort; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "name", label: "Name" },
  { key: "brand", label: "Brand" },
  { key: "price", label: "Price" },
];

function PillFilterRow({
  label,
  options,
  selected,
  onSelect,
  colors,
}: {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (v: string | null) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={{ flexDirection: "row", paddingHorizontal: 16, marginBottom: 8, flexWrap: "wrap", gap: 8, alignItems: "center" }}
      accessibilityRole="radiogroup"
      accessibilityLabel={`${label} filter`}
    >
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginRight: 4 }}>{label}</Text>
      <TouchableOpacity activeOpacity={0.85}
        onPress={() => {
          if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSelect(null);
        }}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 16,
          backgroundColor: selected === null ? colors.primary : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: selected === null }}
      >
        <Text style={{ color: selected === null ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>All</Text>
      </TouchableOpacity>
      {options.map((opt) => {
        const active = selected === opt;
        return (
          <TouchableOpacity activeOpacity={0.85}
            key={opt}
            onPress={() => {
              if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(active ? null : opt);
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: active ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={{ color: active ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const colors = useColors();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [pendingTags, setPendingTags] = useState<Record<string, string[]>>({});
  const pendingTagsDerived = useMemo(() => Object.entries(pendingTags).flatMap(([k, v]) => [k, ...v]), [pendingTags]);
  const [pickerItem, setPickerItem] = useState<Product | null>(null);
  const [postAddProduct, setPostAddProduct] = useState<Product | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [catalogSort, setCatalogSort] = useState<CatalogSort>("relevance");

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
    } catch (e) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (e instanceof DiscoveryAuthError) {
        showAlert("Sign-in Required", "Please sign in to use AI discovery.", [
          { text: "OK" },
        ]);
      } else if (e instanceof DiscoveryError) {
        const detail =
          e.kind === "timeout"
            ? "Discovery timed out. Check your connection and try again."
            : e.kind === "network"
              ? `Network error: ${e.message}`
              : e.kind === "server"
                ? e.status
                  ? `Server error (${e.status}). Try again in a moment.`
                  : e.message
                : "We couldn't parse the discovery response. Try again.";
        showAlert("Discovery Failed", detail, [
          { text: "Retry", onPress: () => void handleDiscover() },
          { text: "Cancel", style: "cancel" },
        ]);
      } else {
        showAlert("Discovery Failed", "We couldn't find that product. Try again.", [
          { text: "Retry", onPress: () => void handleDiscover() },
          { text: "Cancel", style: "cancel" },
        ]);
      }
    } finally {
      setDiscovering(false);
    }
  }, [query, discovering, loadData, router, showToast]);

  const deferredQuery = useDeferredValue(query);
  const [discoveredProducts, setDiscoveredProducts] = useState<
    (typeof PRODUCT_CATALOG)[0][]
  >([]);

  const refreshDiscovered = useCallback(async () => {
    const all = await getAllCatalog();
    const staticIds = new Set(PRODUCT_CATALOG.map((p) => p.id));
    let discovered = all.filter((p) => !staticIds.has(p.id));
    if (discovered.length > 50) discovered = discovered.slice(-50);
    setDiscoveredProducts(discovered);
  }, []);

  useEffect(() => {
    let active = true;
    void getAllCatalog().then((all) => {
      if (!active) return;
      const staticIds = new Set(PRODUCT_CATALOG.map((p) => p.id));
      let discovered = all.filter((p) => !staticIds.has(p.id));
      if (discovered.length > 50) discovered = discovered.slice(-50);
      setDiscoveredProducts(discovered);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleManualAdded = useCallback(() => {
    loadData();
    void refreshDiscovered();
  }, [loadData, refreshDiscovered]);

  const results = useMemo(() => {
    if (discoveredProducts.length === 0) {
      if (deferredQuery.trim().length > 0) return searchCatalog(deferredQuery);
      return sortPreviewByStock(PRODUCT_CATALOG).slice(0, PREVIEW_LIMIT);
    }
    const combined = [...PRODUCT_CATALOG, ...discoveredProducts];
    if (deferredQuery.trim().length === 0) return sortPreviewByStock(combined).slice(0, PREVIEW_LIMIT);
    const fuse = new Fuse(combined, {
      keys: [
        { name: "modelNumber", weight: 0.4 },
        { name: "name", weight: 0.3 },
        { name: "brand", weight: 0.15 },
        { name: "category", weight: 0.1 },
        { name: "description", weight: 0.05 },
      ],
      threshold: 0.4,
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });
    return fuse.search(deferredQuery).map((r) => r.item);
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
    return results.filter(
      (product) => tagFilteredIds.has(product.id) || !trackedIds.has(product.id),
    );
  }, [results, selectedTagIds, tagFilteredIds, trackedIds]);

  const tagCounts = useMemo(() => {
    return countTagMatches(watchlist, {
      region: "all",
      status: "all",
      query: deferredQuery,
    });
  }, [watchlist, deferredQuery]);

  const categories = useMemo(() => getAllCategories(), []);
  const brands = useMemo(() => getAllBrands(), []);

  const categoryBrandFiltered = useMemo(() => {
    let out = tagFilteredResults;
    if (selectedCategory) out = out.filter((p) => p.category === selectedCategory);
    if (selectedBrand) out = out.filter((p) => p.brand === selectedBrand);
    return out;
  }, [tagFilteredResults, selectedCategory, selectedBrand]);

  const sortedResults = useMemo(() => {
    if (catalogSort === "relevance") return categoryBrandFiltered;
    const copy = [...categoryBrandFiltered];
    switch (catalogSort) {
      case "name":
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      case "brand":
        return copy.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
      case "price":
        // No price on catalog items; fall back to name for deterministic order but keep chip parity
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return copy;
    }
  }, [categoryBrandFiltered, catalogSort]);

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
    void pendingTagsDerived;
  }, [pendingTags, pendingTagsDerived]);

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

      {/* Category / Brand filters — pill rows (RegionFilterRow pattern) */}
      <PillFilterRow label="Category" options={categories} selected={selectedCategory} onSelect={setSelectedCategory} colors={colors} />
      <PillFilterRow label="Brand" options={brands} selected={selectedBrand} onSelect={setSelectedBrand} colors={colors} />

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
            Tag filter: showing watchlist matches only — clear to see catalog
          </Text>
        </View>
      )}
      <FlatList showsVerticalScrollIndicator={true}
        data={sortedResults}
        keyExtractor={(item) => item.id}
        initialNumToRender={10}
        windowSize={5}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === "android"}
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
                ? `${sortedResults.length} result${sortedResults.length !== 1 ? "s" : ""}`
                : "All Products"}
            </Text>
            {query.trim().length > 0 && sortedResults.length > 0 && (
              <View style={{ backgroundColor: colors.primary + "14", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>{sortedResults.length}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<SearchEmptyState query={query} selectedTagIds={selectedTagIds} />}
        ListFooterComponent={
          query.trim().length > 0 ? (
            discovering ? (
              <View style={{ alignItems: "center", padding: 24 }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.muted, marginTop: 8 }}>
                  Discovering product...
                </Text>
              </View>
            ) : (
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
            )
          ) : null
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
        onAdded={handleManualAdded}
      />
    </ScreenContainer>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
