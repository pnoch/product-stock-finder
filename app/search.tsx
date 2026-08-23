import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";

import { ScreenContainer } from "@/components/screen-container";
import { TagPickerSheet } from "@/components/tag-picker-sheet";
import { useColors } from "@/hooks/use-colors";
import { searchCatalog, PRODUCT_CATALOG } from "@/lib/catalog";
import { ProductImage } from "@/components/search/product-image";
import { CatalogSearchBar } from "@/components/search/catalog-search-bar";
import { SearchEmptyState } from "@/components/search/search-empty-state";
import { addToWatchlist, getTagDefinitions, getWatchlist } from "@/lib/storage";
import { Product, TagDefinition } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TagFilterRow } from "@/components/tag-filter-row";
import { countTagMatchesByIds, filterWatchlist } from "@/lib/watchlist-org";

export default function SearchScreen() {
  const router = useRouter();
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any");
  const [tagDefinitions, setTagDefinitions] = useState<
    Record<string, TagDefinition>
  >({});
  const [watchlist, setWatchlist] = useState<Product[]>([]);
  const [pendingTags, setPendingTags] = useState<Record<string, string[]>>({});
  const [pickerItem, setPickerItem] = useState<Product | null>(null);
  const [postAddProduct, setPostAddProduct] = useState<Product | null>(null);

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
        setTrackedIds((prev) => new Set(prev).add(item.id));
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

  // Load already-tracked product ids so the + button reflects watchlist membership
  const loadData = useCallback(() => {
    getWatchlist().then((wl) => {
      setWatchlist(wl);
      setTrackedIds(new Set(wl.map((p) => p.id)));
    });
    getTagDefinitions()
      .then((defs) => {
        setTagDefinitions(defs);
        setSelectedTagIds((prev) => prev.filter((id) => id in defs));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 16,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <ProductImage productId={item.id} />
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "600",
                  fontSize: 15,
                }}
                numberOfLines={2}
              >
                {item.name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
                {item.modelNumber}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 4,
                  gap: 6,
                }}
              >
                <View
                  style={{
                    backgroundColor: colors.primary + "22",
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                  >
                    {item.brand}
                  </Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {item.category}
                </Text>
              </View>
            </View>
            {!trackedIds.has(item.id) && (
              <TouchableOpacity
                onPress={() =>
                  setPickerItem({
                    ...item,
                    addedAt: "",
                    isWatched: false,
                    listings: [],
                    tags: pendingTags[item.id] ?? [],
                  })
                }
                style={{
                  marginRight: 8,
                  padding: 6,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <IconSymbol name="tag.fill" size={20} color={colors.muted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => handleAdd(item)}
              disabled={adding === item.id || trackedIds.has(item.id)}
              style={{
                backgroundColor: trackedIds.has(item.id)
                  ? colors.success
                  : colors.primary,
                borderRadius: 20,
                width: 36,
                height: 36,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {adding === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : trackedIds.has(item.id) ? (
                <IconSymbol name="checkmark" size={20} color="#fff" />
              ) : (
                <IconSymbol name="plus" size={20} color="#fff" />
              )}
            </TouchableOpacity>
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
            router.back();
          }}
          onChanged={() => {
            loadData();
          }}
        />
      )}
    </ScreenContainer>
  );
}
