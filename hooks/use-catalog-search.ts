import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import {
  PRODUCT_CATALOG,
  SEARCH_OPTIONS,
  getAllBrands,
  getAllCategories,
  searchCatalog,
  sortCatalogByPrice,
} from "@shared/catalog";
import { getDiscoveredProducts } from "@/lib/storage";
import { dedupeByIdentity } from "@/lib/product-identity";
import { PREVIEW_LIMIT, sortPreviewByStock } from "@/lib/search-preview";
import { countTagMatches, filterWatchlist } from "@/lib/watchlist-org";
import type { Product } from "@/lib/types";

export type CatalogSort = "relevance" | "name" | "price" | "brand";

type Options = {
  query: string;
  watchlist: Product[];
  trackedIds: Set<string>;
  selectedTagIds: string[];
  tagMatchMode: "any" | "all";
  selectedCategory: string | null;
  selectedBrand: string | null;
  catalogSort: CatalogSort;
};

export function useCatalogSearch({
  query,
  watchlist,
  trackedIds,
  selectedTagIds,
  tagMatchMode,
  selectedCategory,
  selectedBrand,
  catalogSort,
}: Options) {
  const deferredQuery = useDeferredValue(query);
  const [discoveredProducts, setDiscoveredProducts] = useState<
    (typeof PRODUCT_CATALOG)[0][]
  >([]);

  // getAllCatalog() returns the static catalog only, so filtering it by its own
  // ids always produced []: AI-discovered products were persisted by
  // discoverProduct but never shown on mobile (desktop reads its store).
  const collectDiscovered = useCallback(async () => {
    const staticIds = new Set(PRODUCT_CATALOG.map((p) => p.id));
    const all = [...PRODUCT_CATALOG, ...(await getDiscoveredProducts())];
    const discovered = all.filter((p) => !staticIds.has(p.id));
    return discovered.length > 50 ? discovered.slice(-50) : discovered;
  }, []);

  const refreshDiscovered = useCallback(async () => {
    setDiscoveredProducts(await collectDiscovered());
  }, [collectDiscovered]);

  useEffect(() => {
    let active = true;
    void collectDiscovered().then((discovered) => {
      if (!active) return;
      setDiscoveredProducts(discovered);
    });
    return () => {
      active = false;
    };
  }, [collectDiscovered]);

  const results = useMemo(() => {
    if (discoveredProducts.length === 0) {
      if (deferredQuery.trim().length > 0) return searchCatalog(deferredQuery);
      return sortPreviewByStock(PRODUCT_CATALOG).slice(0, PREVIEW_LIMIT);
    }
    const combined = dedupeByIdentity([
      ...PRODUCT_CATALOG,
      ...discoveredProducts,
    ]);
    if (deferredQuery.trim().length === 0) {
      return sortPreviewByStock(combined).slice(0, PREVIEW_LIMIT);
    }
    const fuse = new Fuse(combined, SEARCH_OPTIONS);
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
      (product) =>
        tagFilteredIds.has(product.id) || !trackedIds.has(product.id),
    );
  }, [results, selectedTagIds, tagFilteredIds, trackedIds]);

  const tagCounts = useMemo(
    () =>
      countTagMatches(watchlist, {
        region: "all",
        status: "all",
        query: deferredQuery,
      }),
    [watchlist, deferredQuery],
  );

  const categories = useMemo(() => getAllCategories(), []);
  const brands = useMemo(() => getAllBrands(), []);

  const categoryBrandFiltered = useMemo(() => {
    let out = tagFilteredResults;
    if (selectedCategory) {
      out = out.filter((p) => p.category === selectedCategory);
    }
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
        return copy.sort(
          (a, b) =>
            a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name),
        );
      case "price":
        return sortCatalogByPrice(copy);
      default:
        return copy;
    }
  }, [categoryBrandFiltered, catalogSort]);

  return {
    deferredQuery,
    discoveredProducts,
    refreshDiscovered,
    results,
    tagFilteredResults,
    tagCounts,
    categories,
    brands,
    sortedResults,
  };
}
