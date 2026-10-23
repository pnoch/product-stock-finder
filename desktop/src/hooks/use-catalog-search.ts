import { useCallback, useState } from "react";
import { PRODUCT_CATALOG } from "@shared/catalog";
import { storage } from "../storage";
import { discoverProduct, toDiscoverErrorState } from "../../../lib/llm-discovery";
import { nextTagColor } from "../../../lib/tags";
import { useToast } from "./use-toast";
import { useSearchData } from "./use-search-data";
import { useBulkImport } from "./use-bulk-import";
import { useManualAdd } from "./use-manual-add";
import { recordRecent, type CatalogSort } from "../components/search-chrome";

type CatalogProduct = (typeof PRODUCT_CATALOG)[number];

export function useCatalogSearch({
  reloadKey,
  focusOnLoad = true,
  onAdded,
  onDiscovered,
}: {
  reloadKey?: unknown;
  focusOnLoad?: boolean;
  onAdded?: (product: CatalogProduct) => void;
  onDiscovered?: (productId: string) => void;
} = {}) {
  const [query, setQuery] = useState("");
  const [searchTagIds, setSearchTagIds] = useState<string[]>([]);
  const [searchTagMode, setSearchTagMode] = useState<"any" | "all">("any");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [catalogSort, setCatalogSort] = useState<CatalogSort>("relevance");
  const [tagPickerFor, setTagPickerFor] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<{
    title: string;
    message: string;
    retry: boolean;
  } | null>(null);
  const { toast, showToast } = useToast();

  const search = useSearchData({
    query,
    searchTagIds,
    searchTagMode,
    selectedCategory,
    selectedBrand,
    catalogSort,
    reloadKey,
    focusOnLoad,
  });

  const bulk = useBulkImport({
    trackedIds: search.trackedIds,
    setTrackedIds: search.setTrackedIds,
    showToast,
  });

  const manual = useManualAdd({
    categories: search.categories,
    trackedIds: search.trackedIds,
    setTrackedIds: search.setTrackedIds,
    showToast,
  });

  const handleAdd = useCallback(
    async (product: CatalogProduct) => {
      const tags = search.pendingTags[product.id] ?? [];
      try {
        await storage.addToWatchlist({
          ...product,
          addedAt: new Date().toISOString(),
          isWatched: true,
          listings: [],
          tags,
        });
        if (tags.length) {
          search.setPendingTags((prev) => {
            const next = { ...prev };
            delete next[product.id];
            return next;
          });
          setTagPickerFor(null);
        }
        search.setTrackedIds((prev) => new Set([...prev, product.id]));
        showToast(`Added ${product.name}`);
        if (query.trim()) search.setRecentSearches(recordRecent(query));
        onAdded?.(product);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed");
      }
    },
    [query, search, showToast, onAdded],
  );

  const handleDiscover = useCallback(async () => {
    if (!query.trim() || discovering) return;
    setDiscovering(true);
    setDiscoverError(null);
    try {
      const res = await discoverProduct(query, storage);
      if (res) {
        await storage.addToWatchlist({
          ...res.product,
          addedAt: new Date().toISOString(),
          isWatched: true,
          listings: [],
          tags: [],
        });
        search.setTrackedIds((prev) => new Set([...prev, res.product.id]));
        search.setRecentSearches(recordRecent(query));
        onDiscovered?.(res.product.id);
      } else {
        showToast("Discovery failed");
      }
    } catch (e) {
      const errState = toDiscoverErrorState(e);
      setDiscoverError(errState);
      showToast(errState.title);
    } finally {
      setDiscovering(false);
    }
  }, [query, discovering, search, showToast, onDiscovered]);

  const handleCreateTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name || !tagPickerFor) return;
    try {
      const current = await storage.getTagDefinitions();
      const tag = await storage.createTag(name, nextTagColor(current));
      search.setTagDefinitions({ ...current, [tag.id]: tag });
      search.setPendingTags((prev) => ({
        ...prev,
        [tagPickerFor]: [...(prev[tagPickerFor] ?? []), tag.id],
      }));
      setNewTagName("");
    } catch {
      showToast("Couldn't create tag");
    }
  }, [newTagName, tagPickerFor, search, showToast]);

  const toggleTag = useCallback(
    (tagId: string) => {
      if (!tagPickerFor) return;
      search.setPendingTags((prev) => {
        const current = prev[tagPickerFor] ?? [];
        const next = current.includes(tagId)
          ? current.filter((id) => id !== tagId)
          : [...current, tagId];
        return { ...prev, [tagPickerFor]: next };
      });
    },
    [tagPickerFor, search],
  );

  const clearTags = useCallback(() => {
    if (!tagPickerFor) return;
    search.setPendingTags((prev) => {
      const next = { ...prev };
      delete next[tagPickerFor];
      return next;
    });
    setTagPickerFor(null);
  }, [tagPickerFor, search]);

  return {
    ...search,
    ...bulk,
    ...manual,
    query,
    setQuery,
    searchTagIds,
    setSearchTagIds,
    searchTagMode,
    setSearchTagMode,
    selectedCategory,
    setSelectedCategory,
    selectedBrand,
    setSelectedBrand,
    catalogSort,
    setCatalogSort,
    tagPickerFor,
    setTagPickerFor,
    newTagName,
    setNewTagName,
    discovering,
    discoverError,
    toast,
    handleAdd,
    handleDiscover,
    handleCreateTag,
    toggleTag,
    clearTags,
  };
}
