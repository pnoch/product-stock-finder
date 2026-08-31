import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SectionList,
  Text,
  View,
  RefreshControl,
  Alert,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLiveWatchlist } from "@/hooks/use-live-prices";
import {
  getSettings,
  saveSettings,
  getTagDefinitions,
  addToWatchlist,
  removeFromWatchlist,
} from "@/lib/storage";
import { computeWatchlistSummary } from "@/lib/watchlist-summary";
import { computeProductInsights } from "@/lib/product-insights";
import {
  Product,
  TagDefinition,
  WatchlistGroup,
  WatchlistSort,
} from "@/lib/types";
import { checkPriceDropsNow } from "@/lib/background-price-check";
import { getAllRegions } from "@/lib/region-filter";
import { TagPickerSheet } from "@/components/tag-picker-sheet";
import { TagManageSheet } from "@/components/tag-manage-sheet";
import { BulkTagSheet } from "@/components/bulk-tag-sheet";
import { TagFilterRow } from "@/components/tag-filter-row";
import {
  filterWatchlist,
  groupWatchlist,
  sortWatchlist,
  countTagMatches,
  type StatusFilter,
} from "@/lib/watchlist-org";
import { ProductCard } from "@/components/watchlist/product-card";
import { SwipeableCard } from "@/components/watchlist/swipeable-card";
import { SummaryCard } from "@/components/watchlist/summary-card";
import { SearchBar } from "@/components/watchlist/search-bar";
import { ProgressBar } from "@/components/watchlist/progress-bar";
import { WatchlistHeader } from "@/components/watchlist/watchlist-header";
import { SortGroupBar } from "@/components/watchlist/sort-group-bar";
import { RegionFilterRow } from "@/components/watchlist/region-filter-row";
import { EmptyState } from "@/components/watchlist/empty-state";



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
  const [undoProduct, setUndoProduct] = useState<Product | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkingRef = useRef(false);
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

  const insightMap = useMemo(() => {
    const result = computeProductInsights(watchlist, displayCurrency);
    return new Map(result.products.map((p) => [p.productId, p] as const));
  }, [watchlist, displayCurrency]);

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

  const handleRefreshAll = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ok = await refreshAll();
    if (!ok) {
      showAlert(
        "Couldn't refresh prices",
        "The server is unreachable. Showing saved prices.",
      );
    }
  }, [refreshAll]);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    const count = ids.length;
    const doRemove = async () => {
      try {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        for (const id of ids) await removeFromWatchlist(id);
        await reload();
        exitSelection();
      } catch (e) {
        console.error("[Watchlist] bulk delete failed", e);
        showAlert(
          "Delete Failed",
          "Could not remove some products. Please try again.",
        );
      }
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

  const showUndoBar = useCallback((product: Product) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoProduct(product);
    undoTimer.current = setTimeout(() => setUndoProduct(null), 5000);
  }, []);

  const handleSwipeDelete = useCallback(
    async (product: Product) => {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await removeFromWatchlist(product.id);
      await reload();
      showUndoBar(product);
    },
    [reload, showUndoBar],
  );

  const handleUndo = useCallback(async () => {
    if (!undoProduct) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoProduct(null);
    await addToWatchlist(undoProduct);
    await reload();
  }, [undoProduct, reload]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const handleCheckNow = useCallback(async () => {
    if (checkingRef.current || watchlist.length === 0) return;
    checkingRef.current = true;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setChecking(true);
    setCheckProgress({ current: 0, total: watchlist.length });
    try {
      await checkPriceDropsNow((current, total) => {
        setCheckProgress({ current, total });
      });
      await reload();
      await refreshAll();
      await loadData();
    } finally {
      checkingRef.current = false;
      setChecking(false);
      setCheckProgress(null);
    }
  }, [watchlist.length, reload, refreshAll, loadData]);

  const persistChainRef = useRef(Promise.resolve<void>(undefined));
  const persistViewPrefs = useCallback(
    async (sort: WatchlistSort, group: WatchlistGroup) => {
      persistChainRef.current = persistChainRef.current
        .then(async () => {
          const settings = await getSettings();
          await saveSettings({
            ...settings,
            watchlistSort: sort,
            watchlistGroup: group,
          });
        })
        .catch((e) => console.error("[Watchlist] persistViewPrefs failed", e));
      await persistChainRef.current;
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
      <WatchlistHeader
        mode={selectionMode ? "selection" : "normal"}
        selectedCount={selectedIds.size}
        watchlistLength={filteredWatchlist.length}
        isRefreshingAny={isRefreshingAny}
        checking={checking}
        checkProgress={checkProgress}
        onAnalysis={() => router.push("/distributor-analysis")}
        onRefresh={handleRefreshAll}
        onCheckNow={handleCheckNow}
        onAdd={() => router.push("/search")}
        onBulkDelete={handleBulkDelete}
        onBulkTag={() => setBulkTagVisible(true)}
        onExitSelection={exitSelection}
      />

      {watchlist.length > 0 && (
        <SummaryCard
          summary={summary}
          displayCurrency={displayCurrency}
          statusFilter={statusFilter}
          onStatusToggle={setStatusFilter}
          onViewStats={() => router.push("/stats")}
        />
      )}

      {watchlist.length > 0 && (
        <SearchBar query={query} onQueryChange={setQuery} />
      )}

      <ProgressBar
        progress={
          checkProgress ? checkProgress.current / checkProgress.total : 0
        }
        visible={!!(checking && checkProgress)}
      />

      {watchlist.length > 0 && (
        <SortGroupBar
          sortMode={sortMode}
          groupMode={groupMode}
          sortMenuOpen={sortMenuOpen}
          onSortModeChange={(mode) => {
            setSortMode(mode);
            setSortMenuOpen(false);
            void persistViewPrefs(mode, groupMode);
          }}
          onGroupModeChange={(mode) => {
            setGroupMode(mode);
            void persistViewPrefs(sortMode, mode);
          }}
          onSortMenuToggle={() => setSortMenuOpen((v) => !v)}
        />
      )}

      {watchlist.length > 0 && (
        <RegionFilterRow
          regions={regions}
          regionFilter={regionFilter}
          onRegionChange={setRegionFilter}
        />
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
        initialNumToRender={10}
        windowSize={7}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
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
          <EmptyState
            query={query}
            statusFilter={statusFilter}
            regionFilter={regionFilter}
            selectedTagIds={selectedTagIds}
            onClearFilters={() => {
              setRegionFilter("all");
              setSelectedTagIds([]);
              setStatusFilter("all");
              setQuery("");
            }}
            onAddProduct={() => router.push("/search")}
          />
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
          <SwipeableCard onDelete={() => handleSwipeDelete(item)}>
            <ProductCard
              product={item}
              selectionMode={selectionMode}
              insight={
                insightMap.has(item.id)
                  ? {
                      atAllTimeLow: insightMap.get(item.id)!.atAllTimeLow,
                      dropStreak: insightMap.get(item.id)!.dropStreak,
                    }
                  : undefined
              }
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
          </SwipeableCard>
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
      {undoProduct && (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            backgroundColor: colors.foreground,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 6,
          }}
        >
          <Text
            style={{ color: colors.background, fontSize: 13, flex: 1 }}
            numberOfLines={1}
          >
            Removed {undoProduct.name}
          </Text>
          <TouchableOpacity onPress={handleUndo} accessibilityLabel="Undo remove" accessibilityRole="button">
            <Text
              style={{
                color: colors.primary,
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              Undo
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
}
