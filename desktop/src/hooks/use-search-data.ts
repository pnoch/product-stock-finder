import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import {
  PRODUCT_CATALOG,
  getAllCategories,
  getAllBrands,
  SEARCH_OPTIONS,
  sortCatalogByPrice,
} from "@shared/catalog";
import { storage } from "../storage";
import { countTagMatches, filterWatchlist } from "../../../lib/watchlist-org";
import { PREVIEW_LIMIT, sortPreviewByStock } from "../../../lib/search-preview";
import { loadRecent, type CatalogSort } from "../components/search-chrome";
import type { TagDefinition } from "../../../lib/types";

export function useSearchData({
  query,
  searchTagIds,
  searchTagMode,
  selectedCategory,
  selectedBrand,
  catalogSort,
}: {
  query: string;
  searchTagIds: string[];
  searchTagMode: "any" | "all";
  selectedCategory: string | null;
  selectedBrand: string | null;
  catalogSort: CatalogSort;
}) {
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const [watchlistProducts, setWatchlistProducts] = useState<Awaited<ReturnType<typeof storage.getWatchlist>>>([]);
  const [discoveredProducts, setDiscoveredProducts] = useState<typeof PRODUCT_CATALOG>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [tagDefinitions, setTagDefinitions] = useState<Record<string, TagDefinition>>({});
  const [pendingTags, setPendingTags] = useState<Record<string, string[]>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    storage.getWatchlist().then((p) => { setTrackedIds(new Set(p.map((x) => x.id))); setWatchlistProducts(p); }).catch(() => {});
    storage.getDiscoveredProducts().then((disc) => {
      let list = disc.map((p) => ({ id: p.id, name: p.name, modelNumber: p.modelNumber, brand: p.brand, category: p.category, description: p.description ?? "" }));
      if (list.length > 50) list = list.slice(-50);
      setDiscoveredProducts(list as typeof PRODUCT_CATALOG);
    }).catch(() => {});
    queueMicrotask(() => {
      setRecentSearches(loadRecent());
    });
    storage.getSettings().then((s) => setTagDefinitions((s.tagDefinitions ?? {}) as Record<string, TagDefinition>)).catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const combinedCatalog = useMemo(() => {
    if (discoveredProducts.length === 0) return PRODUCT_CATALOG;
    const ids = new Set(PRODUCT_CATALOG.map((p) => p.id));
    return [...PRODUCT_CATALOG, ...discoveredProducts.filter((p) => !ids.has(p.id))] as typeof PRODUCT_CATALOG;
  }, [discoveredProducts]);

  const tagMatchedIds = useMemo(() => {
    if (searchTagIds.length === 0) return null;
    const matching = filterWatchlist(watchlistProducts, {
      region: "all",
      status: "all",
      query: "",
      tagIds: searchTagIds,
      tagMatchMode: searchTagMode,
    });
    return new Set(matching.map((p) => p.id));
  }, [watchlistProducts, searchTagIds, searchTagMode]);

  const fuse = useMemo(() => new Fuse(combinedCatalog, SEARCH_OPTIONS), [combinedCatalog]);
  const deferredQuery = useDeferredValue(query);

  const tagCounts = useMemo(() => {
    return countTagMatches(watchlistProducts, {
      region: "all",
      status: "all",
      query: deferredQuery,
    });
  }, [watchlistProducts, deferredQuery]);

  const results = useMemo(() => {
    let base: typeof combinedCatalog;
    if (!deferredQuery.trim()) base = sortPreviewByStock(combinedCatalog).slice(0, PREVIEW_LIMIT);
    else {
      base = fuse.search(deferredQuery).map((r) => r.item);
    }
    if (searchTagIds.length > 0) {
      base = base.filter((p) => tagMatchedIds?.has(p.id) || !trackedIds.has(p.id));
    }
    return base;
  }, [deferredQuery, fuse, combinedCatalog, searchTagIds, tagMatchedIds, trackedIds]);

  const categories = useMemo(() => getAllCategories(), []);
  const brands = useMemo(() => getAllBrands(), []);

  const categoryBrandFiltered = useMemo(() => {
    let out = results;
    if (selectedCategory) out = out.filter((p) => p.category === selectedCategory);
    if (selectedBrand) out = out.filter((p) => p.brand === selectedBrand);
    return out;
  }, [results, selectedCategory, selectedBrand]);

  const sortedResults = useMemo(() => {
    if (catalogSort === "relevance") return categoryBrandFiltered;
    const copy = [...categoryBrandFiltered];
    switch (catalogSort) {
      case "name":
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      case "brand":
        return copy.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
      case "price":
        return sortCatalogByPrice(copy);
      default:
        return copy;
    }
  }, [categoryBrandFiltered, catalogSort]);

  return {
    trackedIds,
    setTrackedIds,
    watchlistProducts,
    discoveredProducts,
    recentSearches,
    setRecentSearches,
    tagDefinitions,
    setTagDefinitions,
    pendingTags,
    setPendingTags,
    inputRef,
    tagCounts,
    categories,
    brands,
    sortedResults,
  };
}
