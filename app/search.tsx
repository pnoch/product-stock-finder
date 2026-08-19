import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { searchCatalog, PRODUCT_CATALOG } from "@/lib/catalog";
import { fetchProductImage } from "@/lib/server-images";
import { addToWatchlist, getTagDefinitions, getWatchlist } from "@/lib/storage";
import { Product, TagDefinition } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TagFilterRow } from "@/components/tag-filter-row";
import { countTagMatches, filterWatchlist } from "@/lib/watchlist-org";

function ProductImage({ productId }: { productId: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetchProductImage(productId).then((res) => {
      if (active && res) setImageUrl(res.imageUrl);
    });
    return () => {
      active = false;
    };
  }, [productId]);
  if (!imageUrl) return null;
  return (
    <Image
      source={{ uri: imageUrl }}
      style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12 }}
    />
  );
}

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

  const tagCounts = useMemo(
    () => countTagMatches(watchlist, { region: "all", status: "all", query }),
    [watchlist, query],
  );

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
      const product: Product = {
        ...item,
        addedAt: new Date().toISOString(),
        isWatched: true,
        listings: [],
      };
      try {
        await addToWatchlist(product);
        setTrackedIds((prev) => new Set(prev).add(item.id));
        router.back();
      } finally {
        setAdding(null);
      }
    },
    [router, trackedIds, adding],
  );

  // Load already-tracked product ids so the + button reflects watchlist membership
  useEffect(() => {
    getWatchlist().then((wl) => {
      setWatchlist(wl);
      setTrackedIds(new Set(wl.map((p) => p.id)));
    });
    getTagDefinitions()
      .then(setTagDefinitions)
      .catch(() => {});
  }, []);

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
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 8,
        }}
      >
        <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by model number or brand..."
          placeholderTextColor={colors.muted}
          style={{ flex: 1, color: colors.foreground, fontSize: 15 }}
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}>
            <IconSymbol
              name="xmark.circle.fill"
              size={18}
              color={colors.muted}
            />
          </TouchableOpacity>
        )}
      </View>

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
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <IconSymbol name="magnifyingglass" size={40} color={colors.muted} />
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "600",
                fontSize: 16,
                marginTop: 12,
              }}
            >
              {selectedTagIds.length > 0
                ? "No products match these tags"
                : "No results found"}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 14,
                textAlign: "center",
                marginTop: 6,
              }}
            >
              {selectedTagIds.length > 0
                ? "Try a different tag combination"
                : "Try a different model number or brand name"}
            </Text>
          </View>
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
    </ScreenContainer>
  );
}
