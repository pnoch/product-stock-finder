import { useCallback, useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { log } from "@shared/log";
import { showAlert } from "@/lib/alert";
import { useToast } from "@/components/ui/toast";
import { useEntitlements } from "@/hooks/use-entitlements";
import { track } from "@/lib/telemetry";
import { PRODUCT_CATALOG } from "@shared/catalog";
import { toDiscoverErrorState } from "@/lib/llm-discovery";
import {
  clearRecentSearches,
  getRecentSearches,
  recordSearch,
} from "@/lib/recent-searches";
import type { Product } from "@/lib/types";
import { useSearchData } from "@/hooks/use-search-data";
import { useCatalogSearch, type CatalogSort } from "@/hooks/use-catalog-search";
import { addCatalogProduct, discoverAndAddProduct } from "@/lib/add-product";
import { goBackOrHome } from "@/lib/navigation";
import { isMarketplaceInput } from "@/shared/marketplace-url";
import type { EbaySearchListing } from "@/shared/ebay-search";

export function useSearchScreen() {
  const router = useRouter();
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
  const [bulkVisible, setBulkVisible] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [manualPrefill, setManualPrefill] = useState<string | null>(null);
  const [ebayPrefill, setEbayPrefill] = useState<EbaySearchListing | null>(null);

  useEffect(() => {
    void getRecentSearches().then(setRecentSearches);
  }, []);

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

  const catalog = useCatalogSearch({
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
    void catalog.refreshDiscovered();
  }, [loadData, catalog]);

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

  const handleTagPress = useCallback(
    (p: Product) => {
      setPickerItem({
        ...p,
        addedAt: new Date().toISOString(),
        isWatched: false,
        listings: [],
        tags: pendingTags[p.id] ?? [],
      });
    },
    [pendingTags],
  );

  return {
    router,
    showToast,
    isPro,
    paywallVisible,
    setPaywallVisible,
    query,
    setQuery,
    adding,
    discovering,
    pendingTags,
    setPendingTags,
    pickerItem,
    setPickerItem,
    postAddProduct,
    setPostAddProduct,
    recentSearches,
    setRecentSearches,
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
    watchlist,
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
  };
}
