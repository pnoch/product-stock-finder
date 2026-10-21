import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { log } from "@shared/log";
import { updateSettings } from "@/lib/storage";
import { isAcquired } from "@/lib/acquired";
import {
  countTagMatches,
  filterWatchlist,
  groupWatchlist,
  sortWatchlist,
  type StatusFilter,
} from "@/lib/watchlist-org";
import type {
  AppSettings,
  Product,
  TagDefinition,
  WatchlistGroup,
  WatchlistSort,
} from "@/lib/types";

type Options = {
  settings: AppSettings;
  settingsLoading: boolean;
  watchlist: Product[];
  displayCurrency: string;
  tagDefinitions: Record<string, TagDefinition>;
};

export function useWatchlistFilters({
  settings,
  settingsLoading,
  watchlist,
  displayCurrency,
  tagDefinitions,
}: Options) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showAcquired, setShowAcquired] = useState(false);
  const [filtersManual, setFiltersManual] = useState<boolean | null>(null);
  const [priceRange, setPriceRange] = useState<[number, number] | undefined>(
    undefined,
  );
  const [priceMinInput, setPriceMinInput] = useState("");
  const [priceMaxInput, setPriceMaxInput] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any");
  const [sortMode, setSortMode] = useState<WatchlistSort>("recent");
  const [groupMode, setGroupMode] = useState<WatchlistGroup>("off");
  const [hydrated, setHydrated] = useState(false);

  if (!hydrated && !settingsLoading) {
    setHydrated(true);
    setSortMode(settings.watchlistSort ?? "recent");
    setGroupMode(settings.watchlistGroup ?? "off");
    setInStockOnly(settings.watchlistInStockOnly ?? false);
    const storedRange = settings.watchlistPriceRange ?? null;
    if (storedRange && Array.isArray(storedRange) && storedRange.length === 2) {
      const [min, max] = storedRange;
      const isMaxFinite =
        Number.isFinite(max) && max !== Number.MAX_SAFE_INTEGER;
      setPriceRange([min, max]);
      setPriceMinInput(min === 0 ? "" : String(min));
      setPriceMaxInput(isMaxFinite ? String(max) : "");
    }
  }

  // Real-time price range filter without Apply — updates as user types.
  useEffect(() => {
    if (!hydrated) return;
    const minStr = priceMinInput.trim();
    const maxStr = priceMaxInput.trim();
    if (minStr === "" && maxStr === "") {
      // Latch the last valid range while the user types; deriving this would
      // clear the filter on an intermediate invalid value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPriceRange(undefined);
      return;
    }
    const min = minStr === "" ? 0 : Number(minStr);
    const max = maxStr === "" ? Infinity : Number(maxStr);
    if (
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min < 0 ||
      max < 0 ||
      min > max
    ) {
      return;
    }
    const effectiveMax = max === Infinity ? Number.MAX_SAFE_INTEGER : max;
    setPriceRange((prev) => {
      if (prev && prev[0] === min && prev[1] === effectiveMax) return prev;
      return [min, effectiveMax];
    });
  }, [hydrated, priceMinInput, priceMaxInput]);

  // Persist priceRange / inStockOnly to AppSettings (real-time). Uses the
  // serialized updateSettings: a whole-object saveSettings with a read taken
  // outside the write queue raced the sort/group persist below, so changing
  // both quickly dropped one field.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const persist = async () => {
      try {
        if (!cancelled) {
          await updateSettings({
            watchlistInStockOnly: inStockOnly,
            watchlistPriceRange: priceRange ?? null,
          });
        }
      } catch (e) {
        log.error("[Watchlist] settings persist failed", e);
      }
    };
    void persist();
    return () => {
      cancelled = true;
    };
  }, [hydrated, inStockOnly, priceRange]);

  const sortModeRef = useRef(sortMode);
  const groupModeRef = useRef(groupMode);
  useEffect(() => {
    sortModeRef.current = sortMode;
  }, [sortMode]);
  useEffect(() => {
    groupModeRef.current = groupMode;
  }, [groupMode]);

  const persistViewPrefs = useCallback(
    async (sort: WatchlistSort, group: WatchlistGroup) => {
      try {
        await updateSettings({ watchlistSort: sort, watchlistGroup: group });
      } catch (e) {
        log.error("[Watchlist] persistViewPrefs failed", e);
      }
    },
    [],
  );

  const validSelectedTagIds = useMemo(
    () => selectedTagIds.filter((id) => tagDefinitions[id]),
    [selectedTagIds, tagDefinitions],
  );

  const filteredWatchlist = useMemo(
    () =>
      filterWatchlist(watchlist, {
        region: regionFilter,
        tagIds: validSelectedTagIds,
        tagMatchMode,
        status: statusFilter,
        query,
        priceRange,
        inStockOnly,
        displayCurrency,
      }).filter((p) => showAcquired || !isAcquired(p)),
    [
      watchlist,
      regionFilter,
      validSelectedTagIds,
      tagMatchMode,
      statusFilter,
      query,
      priceRange,
      inStockOnly,
      displayCurrency,
      showAcquired,
    ],
  );

  const tagCounts = useMemo(
    () =>
      countTagMatches(watchlist, {
        region: regionFilter,
        status: statusFilter,
        query,
        priceRange,
        inStockOnly,
        displayCurrency,
      }),
    [
      watchlist,
      regionFilter,
      statusFilter,
      query,
      priceRange,
      inStockOnly,
      displayCurrency,
    ],
  );

  const sections = useMemo(
    () =>
      groupWatchlist(
        sortWatchlist(filteredWatchlist, sortMode, displayCurrency),
        groupMode,
        tagDefinitions,
      ),
    [filteredWatchlist, sortMode, groupMode, tagDefinitions, displayCurrency],
  );

  const toggleTagFilter = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  }, []);

  // Number of non-default filters driving the Filters button badge. Each
  // dimension counts at most 1: query, tags, status, price, region,
  // in-stock-on, and show-acquired-on.
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (query.trim() !== "") count += 1;
    if (selectedTagIds.length > 0) count += 1;
    if (statusFilter !== "all") count += 1;
    if (
      priceRange !== undefined ||
      priceMinInput !== "" ||
      priceMaxInput !== ""
    ) {
      count += 1;
    }
    if (regionFilter !== "all") count += 1;
    if (inStockOnly) count += 1;
    if (showAcquired) count += 1;
    return count;
  }, [
    query,
    selectedTagIds,
    statusFilter,
    priceRange,
    priceMinInput,
    priceMaxInput,
    regionFilter,
    inStockOnly,
    showAcquired,
  ]);

  const filtersExpanded = filtersManual ?? activeFilterCount > 0;

  const clearAllFilters = useCallback(() => {
    setRegionFilter("all");
    setSelectedTagIds([]);
    setStatusFilter("all");
    setInStockOnly(false);
    setPriceRange(undefined);
    setPriceMinInput("");
    setPriceMaxInput("");
    setQuery("");
    setShowAcquired(true);
  }, []);

  return {
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    regionFilter,
    setRegionFilter,
    inStockOnly,
    setInStockOnly,
    showAcquired,
    setShowAcquired,
    filtersManual,
    setFiltersManual,
    priceRange,
    setPriceRange,
    priceMinInput,
    setPriceMinInput,
    priceMaxInput,
    setPriceMaxInput,
    selectedTagIds,
    setSelectedTagIds,
    tagMatchMode,
    setTagMatchMode,
    sortMode,
    setSortMode,
    groupMode,
    setGroupMode,
    sortModeRef,
    groupModeRef,
    persistViewPrefs,
    validSelectedTagIds,
    filteredWatchlist,
    tagCounts,
    sections,
    toggleTagFilter,
    activeFilterCount,
    filtersExpanded,
    clearAllFilters,
  };
}
