import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SectionList,
  Image,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";

import { ScreenContainer } from "@/components/screen-container";
import { StockBadge } from "@/components/stock-badge";
import { useColors } from "@/hooks/use-colors";
import { useLiveWatchlist } from "@/hooks/use-live-prices";
import {
  getSettings,
  saveSettings,
  getTagDefinitions,
  removeFromWatchlist,
} from "@/lib/storage";
import { computeWatchlistSummary } from "@/lib/watchlist-summary";
import {
  Product,
  TagDefinition,
  WatchlistGroup,
  WatchlistSort,
} from "@/lib/types";
import { formatPrice, getBestPrice, convertPrice } from "@/lib/currency";
import {
  formatLastRefreshed,
  getLastRefreshedColor,
} from "@/lib/last-refreshed";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { checkPriceDropsNow } from "@/lib/background-price-check";
import { getAllRegions } from "@/lib/region-filter";
import { getTagById } from "@/lib/tags";
import { TagPickerSheet } from "@/components/tag-picker-sheet";
import { TagManageSheet } from "@/components/tag-manage-sheet";
import { BulkTagSheet } from "@/components/bulk-tag-sheet";
import { TagFilterRow } from "@/components/tag-filter-row";
import { fetchProductImage } from "@/lib/server-images";
import {
  filterWatchlist,
  groupWatchlist,
  sortWatchlist,
  countTagMatches,
  GROUP_OPTIONS,
  SORT_OPTIONS,
  type StatusFilter,
} from "@/lib/watchlist-org";
import { ProductCard } from "@/components/watchlist/product-card";



export default function WatchlistScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    products: watchlist,
    loaded,
    isRefreshingAny,
    reload,
    refreshAll,
  } = useLiveWatchlist();
  const [sortMode, setSortMode] = useState<WatchlistSort>("recent");
  const [groupMode, setGroupMode] = useState<WatchlistGroup>("off");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [tagDefinitions, setTagDefinitions] = useState<
    Record<string, TagDefinition>
  >({});
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any");
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [manageVisible, setManageVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagVisible, setBulkTagVisible] = useState(false);
  const regions = useMemo(() => getAllRegions(), []);

  const loadData = useCallback(async () => {
    const settings = await getSettings();
    setDisplayCurrency(settings?.displayCurrency ?? "USD");
    setSortMode(settings?.watchlistSort ?? "recent");
    setGroupMode(settings?.watchlistGroup ?? "off");
    const defs = await getTagDefinitions();
    setTagDefinitions(defs);
    setSelectedTagIds((prev) => prev.filter((id) => id in defs));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
      void loadData();
    }, [reload, loadData]),
  );

  const filteredWatchlist = useMemo(
    () =>
      filterWatchlist(watchlist, {
        region: regionFilter,
        tagIds: selectedTagIds,
        tagMatchMode,
        status: statusFilter,
        query,
      }),
    [watchlist, regionFilter, selectedTagIds, tagMatchMode, statusFilter, query],
  );

  const tagCounts = useMemo(
    () =>
      countTagMatches(watchlist, {
        region: regionFilter,
        status: statusFilter,
        query,
      }),
    [watchlist, regionFilter, statusFilter, query],
  );

  const sections = useMemo(
    () =>
      groupWatchlist(
        sortWatchlist(filteredWatchlist, sortMode),
        groupMode,
        tagDefinitions,
      ),
    [filteredWatchlist, sortMode, groupMode, tagDefinitions],
  );

  const summary = useMemo(
    () => computeWatchlistSummary(watchlist, displayCurrency),
    [watchlist, displayCurrency],
  );

  const toggleTagFilter = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    const count = ids.length;
    const doRemove = async () => {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      for (const id of ids) await removeFromWatchlist(id);
      await reload();
      exitSelection();
    };
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(
          `Remove ${count} product${count !== 1 ? "s" : ""} from your watchlist?`,
        )
      ) {
        void doRemove();
      }
      return;
    }
    Alert.alert(
      "Remove Products",
      `Remove ${count} product${count !== 1 ? "s" : ""} from your watchlist?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: doRemove },
      ],
    );
  }, [selectedIds, reload, exitSelection]);

  const handleBulkTagChanged = useCallback(() => {
    void reload();
    void loadData();
    exitSelection();
  }, [reload, loadData, exitSelection]);

  const handleDelete = useCallback(
    (productId: string, productName: string) => {
      const doRemove = async () => {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          );
        await removeFromWatchlist(productId);
        await reload();
      };
      if (Platform.OS === "web") {
        if (
          typeof window !== "undefined" &&
          window.confirm(`Remove "${productName}" from your watchlist?`)
        ) {
          void doRemove();
        }
        return;
      }
      Alert.alert(
        "Remove Product",
        `Remove "${productName}" from your watchlist?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: doRemove },
        ],
      );
    },
    [reload],
  );

  const handleCheckNow = useCallback(async () => {
    if (checking || watchlist.length === 0) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setChecking(true);
    setCheckProgress({ current: 0, total: watchlist.length });
    try {
      await checkPriceDropsNow((current, total) => {
        setCheckProgress({ current, total });
      });
      await reload();
      void refreshAll();
      await loadData();
    } finally {
      setChecking(false);
      setCheckProgress(null);
    }
  }, [checking, watchlist.length, reload, refreshAll, loadData]);

  const persistViewPrefs = useCallback(
    async (sort: WatchlistSort, group: WatchlistGroup) => {
      const settings = await getSettings();
      await saveSettings({
        ...settings,
        watchlistSort: sort,
        watchlistGroup: group,
      });
    },
    [],
  );

  if (!loaded) {
    return (
      <ScreenContainer>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {selectionMode ? (
        <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">
              {selectedIds.size} Selected
            </Text>
            <Text className="text-muted text-sm">Tap products to select</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              onPress={handleBulkDelete}
              style={{
                backgroundColor: colors.error,
                borderRadius: 20,
                paddingHorizontal: 14,
                height: 40,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <IconSymbol name="trash.fill" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                Delete
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setBulkTagVisible(true)}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 20,
                paddingHorizontal: 14,
                height: 40,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <IconSymbol name="tag.fill" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                Tag
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={exitSelection}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 20,
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <IconSymbol name="xmark" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">Watchlist</Text>
            <Text className="text-muted text-sm">
              {filteredWatchlist.length} product
              {filteredWatchlist.length !== 1 ? "s" : ""} tracked
            </Text>
          </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/distributor-analysis");
            }}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              paddingHorizontal: 14,
              height: 40,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <IconSymbol
              name="chart.bar.xaxis"
              size={16}
              color={colors.primary}
            />
            <Text
              style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}
            >
              Analysis
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const ok = await refreshAll();
              if (!ok) {
                showAlert(
                  "Couldn't refresh prices",
                  "The server is unreachable. Showing saved prices.",
                );
              }
            }}
            disabled={isRefreshingAny}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              paddingHorizontal: 14,
              height: 40,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {isRefreshingAny ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <IconSymbol
                name="arrow.clockwise"
                size={16}
                color={colors.primary}
              />
            )}
            <Text
              style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}
            >
              Refresh all
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: checking ? colors.muted : colors.primary,
              borderRadius: 20,
              paddingHorizontal: 14,
              height: 40,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              opacity: watchlist.length === 0 ? 0.5 : 1,
            }}
            onPress={handleCheckNow}
            disabled={checking || watchlist.length === 0}
          >
            {checking ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <IconSymbol name="arrow.clockwise" size={16} color="#fff" />
            )}
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
              {checkProgress
                ? `Checking ${checkProgress.current}/${checkProgress.total}`
                : "Check Now"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              borderRadius: 20,
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/search");
            }}
          >
            <IconSymbol name="plus" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      )}

      {watchlist.length > 0 && (
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 12,
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              Total Value
            </Text>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 22,
                fontWeight: "700",
              }}
            >
              {formatPrice(summary.totalValue, displayCurrency)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
            {(
              [
                {
                  key: "in_stock",
                  label: "In Stock",
                  value: summary.inStock,
                  color: colors.success,
                },
                {
                  key: "back_order",
                  label: "Back Order",
                  value: summary.backOrder,
                  color: colors.warning,
                },
                {
                  key: "out_of_stock",
                  label: "Out of Stock",
                  value: summary.outOfStock,
                  color: colors.error,
                },
              ] as const
            ).map((col) => (
              <TouchableOpacity
                key={col.key}
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setStatusFilter((prev) =>
                    prev === col.key ? "all" : col.key,
                  );
                }}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  paddingVertical: 4,
                  paddingHorizontal: 6,
                  backgroundColor:
                    statusFilter === col.key
                      ? col.color + "22"
                      : "transparent",
                }}
              >
                <Text
                  style={{ color: col.color, fontSize: 16, fontWeight: "600" }}
                >
                  {col.value}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {col.label}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                {summary.listingCount}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Listings
              </Text>
            </View>
          </View>
        </View>
      )}

      {watchlist.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginHorizontal: 16,
            marginBottom: 10,
            paddingHorizontal: 12,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search watchlist..."
            placeholderTextColor={colors.muted}
            style={{
              flex: 1,
              marginLeft: 8,
              color: colors.foreground,
              fontSize: 14,
            }}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              style={{ padding: 4 }}
            >
              <IconSymbol
                name="xmark.circle.fill"
                size={16}
                color={colors.muted}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {checking && checkProgress && (
        <View
          className="h-1 mx-4 mb-2 rounded-full overflow-hidden"
          style={{ backgroundColor: colors.primary + "20" }}
        >
          <View
            className="h-full rounded-full"
            style={{
              width: `${(checkProgress.current / checkProgress.total) * 100}%`,
              backgroundColor: colors.primary,
            }}
          />
        </View>
      )}

      {watchlist.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingBottom: 10,
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSortMenuOpen((v) => !v);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}
            >
              Sort: {SORT_OPTIONS.find((o) => o.key === sortMode)?.label}
            </Text>
            <IconSymbol name="chevron.down" size={12} color={colors.muted} />
          </TouchableOpacity>
          {GROUP_OPTIONS.map((opt) => {
            const active = groupMode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setGroupMode(opt.key);
                  void persistViewPrefs(sortMode, opt.key);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    color: active ? "#fff" : colors.muted,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {sortMenuOpen && (
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 10,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          {SORT_OPTIONS.map((opt) => {
            const active = sortMode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSortMode(opt.key);
                  setSortMenuOpen(false);
                  void persistViewPrefs(opt.key, groupMode);
                }}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  backgroundColor: active
                    ? colors.primary + "18"
                    : "transparent",
                }}
              >
                <Text
                  style={{
                    color: active ? colors.primary : colors.foreground,
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {watchlist.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 16,
            marginBottom: 8,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {["all", ...regions].map((region) => (
            <TouchableOpacity
              key={region}
              onPress={() => setRegionFilter(region)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor:
                  regionFilter === region ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: regionFilter === region ? "#fff" : colors.foreground,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {region === "all" ? "All" : region}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TagFilterRow
        tagDefinitions={tagDefinitions}
        selectedTagIds={selectedTagIds}
        tagMatchMode={tagMatchMode}
        counts={tagCounts}
        onToggleTag={toggleTagFilter}
        onChangeMode={setTagMatchMode}
        onClearAll={() => setSelectedTagIds([])}
        onManage={() => setManageVisible(true)}
      />

      <SectionList
        sections={sections.map((s) => ({ ...s, data: s.products }))}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 24,
          flexGrow: 1,
        }}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingAny}
            onRefresh={refreshAll}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 80,
            }}
          >
            <IconSymbol name="list.bullet" size={48} color={colors.muted} />
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "600",
                fontSize: 18,
                marginTop: 16,
              }}
            >
              {regionFilter !== "all" ||
              selectedTagIds.length > 0 ||
              statusFilter !== "all" ||
              query.trim().length > 0
                ? "No products match your filters"
                : "No products yet"}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 14,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              {regionFilter !== "all" ||
              selectedTagIds.length > 0 ||
              statusFilter !== "all" ||
              query.trim().length > 0
                ? "Try clearing your filters or adding products"
                : "Add products to track their availability and prices globally"}
            </Text>
            {regionFilter !== "all" ||
            selectedTagIds.length > 0 ||
            statusFilter !== "all" ||
            query.trim().length > 0 ? (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 20,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  marginTop: 20,
                }}
                onPress={() => {
                  setRegionFilter("all");
                  setSelectedTagIds([]);
                  setStatusFilter("all");
                  setQuery("");
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                  Clear Filters
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 20,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  marginTop: 20,
                }}
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/search");
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                  Add Product
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => {
          if (groupMode === "off") return null;
          const tag =
            groupMode === "tag"
              ? Object.values(tagDefinitions).find(
                  (t) => t.name === section.title,
                )
              : undefined;
          return (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 8,
                backgroundColor: colors.background,
              }}
            >
              {tag && (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: tag.color,
                  }}
                />
              )}
              <Text
                style={{ color: colors.foreground, fontWeight: "700", fontSize: 14 }}
              >
                {section.title}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                · {section.products.length}
              </Text>
            </View>
          );
        }}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.id)}
            onPress={() => {
              if (selectionMode) {
                toggleSelection(item.id);
              } else {
                router.push(`/product/${item.id}`);
              }
            }}
            onLongPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectionMode(true);
              setSelectedIds(new Set([item.id]));
            }}
            onDelete={() => handleDelete(item.id, item.name)}
            onTagPress={() => setPickerProduct(item)}
            tagDefinitions={tagDefinitions}
          />
        )}
      />
      <TagPickerSheet
        visible={!!pickerProduct}
        product={pickerProduct}
        onClose={() => setPickerProduct(null)}
        onChanged={() => {
          void reload();
          void loadData();
        }}
      />
      <TagManageSheet
        visible={manageVisible}
        onClose={() => setManageVisible(false)}
        onChanged={() => {
          void reload();
          void loadData();
        }}
      />
      <BulkTagSheet
        visible={bulkTagVisible}
        productIds={Array.from(selectedIds)}
        tagDefinitions={tagDefinitions}
        onClose={() => setBulkTagVisible(false)}
        onChanged={handleBulkTagChanged}
      />
    </ScreenContainer>
  );
}
