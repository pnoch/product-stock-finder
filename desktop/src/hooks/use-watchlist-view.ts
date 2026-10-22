import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getBestPrice } from "@/lib/currency";
import { isAcquired } from "../../../lib/acquired";
import { getAllRegions } from "../../../lib/region-filter";
import { computeWatchlistSummary } from "../../../lib/watchlist-summary";
import { computeProductInsights } from "../../../lib/product-insights";
import { computeDealScore, type DealScore } from "../../../lib/deal-score";
import {
  countTagMatches,
  filterWatchlist,
  groupWatchlist,
  type StatusFilter,
} from "../../../lib/watchlist-org";
import { flattenWatchlistRows } from "../lib/watchlist-rows";
import { getTrend } from "../lib/watchlist-view";
import { storage } from "../storage";
import type {
  Product,
  TagDefinition,
  WatchlistGroup,
} from "../../../lib/types";

export type SortKey = "name" | "price" | "deal" | "trend" | "lastUpdated";
export type FilterKey = "all" | "in_stock" | "back_order" | "out_of_stock";

type Options = {
  products: Product[];
  displayCurrency: string;
  tagDefinitions: Record<string, TagDefinition>;
  searchParams: URLSearchParams;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  loading: boolean;
  settings: { watchlistInStockOnly?: boolean; watchlistGroup?: WatchlistGroup; watchlistSortKey?: SortKey; watchlistSortAsc?: boolean; watchlistPriceRange?: [number, number] | null } | null;
};

export function useWatchlistView({
  products,
  displayCurrency,
  tagDefinitions,
  searchParams,
  scrollRef,
  loading,
  settings,
}: Options) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [groupMode, setGroupMode] = useState<WatchlistGroup>("off");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any");
  const [query, setQuery] = useState("");
  const [inStockOnly, setInStockOnly] = useState(
    () => searchParams.get("inStock") === "1",
  );
  const [showAcquired, setShowAcquired] = useState(false);
  const inStockParamRef = useRef(searchParams.get("inStock") === "1");
  const [priceMinInput, setPriceMinInput] = useState("");
  const [priceMaxInput, setPriceMaxInput] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const regions = useMemo(() => getAllRegions(), []);

  const priceRange = useMemo<[number, number] | undefined>(() => {
    if (priceMinInput.trim() === "" && priceMaxInput.trim() === "")
      return undefined;
    const min = priceMinInput.trim() === "" ? 0 : Number(priceMinInput);
    const max =
      priceMaxInput.trim() === ""
        ? Number.MAX_SAFE_INTEGER
        : Number(priceMaxInput);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min)
      return undefined;
    return [min, max];
  }, [priceMinInput, priceMaxInput]);
  const priceInvalid =
    (priceMinInput.trim() !== "" || priceMaxInput.trim() !== "") &&
    priceRange === undefined;

  useEffect(() => {
    // A storage read failure must not reject unhandled; the view prefs simply
    // keep their defaults.
    storage
      .getSettings()
      .then((s) => {
        if (!inStockParamRef.current)
          setInStockOnly(s.watchlistInStockOnly ?? false);
        setGroupMode(s.watchlistGroup ?? "off");
        setSortKey((s.watchlistSortKey ?? "name") as SortKey);
        setSortAsc(s.watchlistSortAsc ?? true);
        const storedRange = s.watchlistPriceRange ?? null;
        if (
          storedRange &&
          Array.isArray(storedRange) &&
          storedRange.length === 2
        ) {
          const [min, max] = storedRange;
          setPriceMinInput(min === 0 ? "" : String(min));
          setPriceMaxInput(
            max === Number.MAX_SAFE_INTEGER ? "" : String(max),
          );
        }
      })
      .catch(() => {});
  }, [settings]);

  useEffect(() => {
    if (loading) return;
    // Serialized updateSettings: a whole-object write with a read taken outside
    // the queue raced other settings writes (theme, basket alert) and could
    // drop their fields.
    storage
      .updateSettings({
        watchlistInStockOnly: inStockOnly,
        watchlistPriceRange: priceRange ?? null,
        watchlistGroup: groupMode,
        watchlistSortKey: sortKey,
        watchlistSortAsc: sortAsc,
      })
      .catch(() => {});
  }, [inStockOnly, priceRange, groupMode, sortKey, sortAsc, loading]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setCollapsed(el.scrollTop > 40);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [loading, scrollRef]);

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  // Single pipeline: apply all filters (region, status, tags, query) in one pass
  const filtered = useMemo(
    () =>
      filterWatchlist(products, {
        region: regionFilter,
        tagIds: selectedTagIds,
        tagMatchMode,
        status: filter as StatusFilter,
        query,
        priceRange,
        inStockOnly,
        displayCurrency,
      }).filter((p) => showAcquired || !isAcquired(p)),
    [
      products,
      regionFilter,
      selectedTagIds,
      tagMatchMode,
      filter,
      query,
      priceRange,
      inStockOnly,
      displayCurrency,
      showAcquired,
    ],
  );

  const summary = useMemo(
    () => computeWatchlistSummary(products, displayCurrency),
    [products, displayCurrency],
  );

  const insightMap = useMemo(() => {
    const result = computeProductInsights(products, displayCurrency);
    return new Map(result.products.map((entry) => [entry.productId, entry]));
  }, [products, displayCurrency]);

  const tagCounts = useMemo(
    () =>
      countTagMatches(products, {
        region: regionFilter,
        status: filter as StatusFilter,
        query,
        priceRange,
        inStockOnly,
        displayCurrency,
      }),
    [
      products,
      regionFilter,
      filter,
      query,
      inStockOnly,
      priceRange,
      displayCurrency,
    ],
  );

  const dealScores: Map<string, DealScore | null> = useMemo(
    () =>
      new Map(
        filtered.map((p) => [
          p.id,
          computeDealScore(p.listings ?? [], displayCurrency),
        ]),
      ),
    [filtered, displayCurrency],
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          // `?? ""` so a malformed product without a name doesn't throw; the
          // id tiebreak keeps the order deterministic (mobile does the same).
          cmp =
            (a.name ?? "").localeCompare(b.name ?? "") ||
            a.id.localeCompare(b.id);
          break;
        case "price": {
          // `?? []` like the shared sort/mobile card: a product restored from a
          // partial backup or sync payload has no listings, and getBestPrice
          // dereferences its argument (it threw and blanked the table).
          const aPrice =
            getBestPrice(a.listings ?? [], displayCurrency)?.price ?? null;
          const bPrice =
            getBestPrice(b.listings ?? [], displayCurrency)?.price ?? null;
          if (aPrice === null && bPrice === null) cmp = 0;
          else if (aPrice === null) return 1;
          else if (bPrice === null) return -1;
          else cmp = aPrice - bPrice;
          break;
        }
        case "deal": {
          const aScore = dealScores.get(a.id)?.score ?? null;
          const bScore = dealScores.get(b.id)?.score ?? null;
          if (aScore === null && bScore === null) cmp = 0;
          else if (aScore === null) return 1;
          else if (bScore === null) return -1;
          else cmp = bScore - aScore;
          break;
        }
        case "trend": {
          const order = { up: 0, flat: 1, down: 2 };
          cmp = order[getTrend(a)] - order[getTrend(b)];
          break;
        }
        case "lastUpdated": {
          // NaN-safe: an invalid date made the comparator return NaN, which is
          // implementation-defined ordering (mobile guards the same way).
          const aTime = Date.parse(a.lastRefreshed ?? a.addedAt ?? "") || 0;
          const bTime = Date.parse(b.lastRefreshed ?? b.addedAt ?? "") || 0;
          cmp = aTime - bTime || a.id.localeCompare(b.id);
          break;
        }
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortAsc, displayCurrency, dealScores]);

  const sections = useMemo(
    () => groupWatchlist(sorted, groupMode, tagDefinitions),
    [sorted, groupMode, tagDefinitions],
  );

  const rows = useMemo(
    () => flattenWatchlistRows(groupMode, sorted, sections),
    [groupMode, sorted, sections],
  );

  // TanStack Virtual returns non-memoizable functions by design; the compiler
  // skipping this component is expected.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 76,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return {
    sortKey,
    setSortKey,
    sortAsc,
    setSortAsc,
    groupMode,
    setGroupMode,
    filter,
    setFilter,
    regionFilter,
    setRegionFilter,
    selectedId,
    setSelectedId,
    selectedTagIds,
    setSelectedTagIds,
    tagMatchMode,
    setTagMatchMode,
    query,
    setQuery,
    inStockOnly,
    setInStockOnly,
    showAcquired,
    setShowAcquired,
    priceMinInput,
    setPriceMinInput,
    priceMaxInput,
    setPriceMaxInput,
    priceRange,
    priceInvalid,
    selectionMode,
    setSelectionMode,
    selectedIds,
    collapsed,
    regions,
    filtered,
    summary,
    insightMap,
    tagCounts,
    dealScores,
    sorted,
    sections,
    rows,
    rowVirtualizer,
    virtualRows,
    toggleTagFilter,
    toggleSelection,
    exitSelection,
    handleSort,
  };
}
