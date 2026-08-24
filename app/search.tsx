import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";

import { ScreenContainer } from "@/components/screen-container";
import { TagPickerSheet } from "@/components/tag-picker-sheet";
import { BulkImportModal } from "@/components/search/bulk-import-modal";
import { useColors } from "@/hooks/use-colors";
import { searchCatalog, PRODUCT_CATALOG } from "@/lib/catalog";
import { CatalogSearchBar } from "@/components/search/catalog-search-bar";
import { SearchEmptyState } from "@/components/search/search-empty-state";
import { CatalogProductCard } from "@/components/search/catalog-product-card";
import { addToWatchlist } from "@/lib/storage";
import { Product } from "@/lib/types";
import { useSearchData } from "@/hooks/use-search-data";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TagFilterRow } from "@/components/tag-filter-row";
import { countTagMatchesByIds, filterWatchlist } from "@/lib/watchlist-org";

export default function SearchScreen() {
  const router = useRouter();
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [pendingTags, setPendingTags] = useState<Record<string, string[]>>({});
  const [pickerItem, setPickerItem] = useState<Product | null>(null);
  const [postAddProduct, setPostAddProduct] = useState<Product | null>(null);
  const [bulkVisible, setBulkVisible] = useState(false);
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

  const results =
    query.trim().length > 0 ? searchCatalog(query) : PRODUCT_CATALOG;

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
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        loadData();
        setPendingTags((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        if (pending.length > 0) {
          setPostAddProduct(product);
        } else {
          router.back();
        }
      } finally {
        setAdding(null);
      }
    },
    [router, trackedIds, adding, pendingTags],
  );

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
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
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
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setBulkVisible(true);
          }}
          style={{ padding: 4 }}
        >
          <IconSymbol
            name="square.and.arrow.down"
            size={22}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <CatalogSearchBar query={query} onQueryChange={setQuery} />

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
      <FlatList
        data={tagFilteredResults}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListHeaderComponent={
          <Text
            style={{
              color: colors.muted,
              fontSize: 12,
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 10,
            }}
          >
            {query.trim()
              ? `${tagFilteredResults.length} result${tagFilteredResults.length !== 1 ? "s" : ""}`
              : "All Products"}
          </Text>
        }
        ListEmptyComponent={
          <SearchEmptyState query={query} selectedTagIds={selectedTagIds} />
        }
        renderItem={({ item }) => (
          <CatalogProductCard
            product={item as Product}
            isTracked={trackedIds.has(item.id)}
            isAdding={adding === item.id}
            onAdd={(p) => handleAdd(p)}
            onTagPress={(p) => setPickerItem({
              ...p,
              addedAt: "",
              isWatched: false,
              listings: [],
              tags: pendingTags[p.id] ?? [],
            })}
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
    </ScreenContainer>
  );
}
