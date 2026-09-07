import { useState, useMemo, useRef, useEffect, useCallback, Fragment } from "react";
import { useNavigate } from "react-router";
import {
  RefreshCw,
  Share2,
  Zap,
  Trash2,
  ArrowUpDown,
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Tag as TagIcon,
  Settings2,
  X,
} from "lucide-react";
import { useWatchlist, useSettings } from "../hooks/use-storage";
import { useToast } from "../hooks/use-toast";
import { storage } from "../storage";
import { formatPrice, getBestPrice } from "@shared/currency";
import { formatLastRefreshed } from "../../../lib/last-refreshed";
import { getApiBaseUrl } from "../lib/api-base";
import { computeWatchlistSummary } from "../../../lib/watchlist-summary";
import { getAllRegions } from "../../../lib/region-filter";
import { StockBadge } from "../components/StockBadge";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ProductImage } from "../components/ProductImage";
import { TagFilterRow } from "../components/TagFilterRow";
import { countTagMatches, filterWatchlist, groupWatchlist, type StatusFilter } from "../../../lib/watchlist-org";
import { TAG_PALETTE, nextTagColor } from "../../../lib/tags";
import { createTRPCClient } from "../lib/trpc";
import { composeLiveListings } from "../../../lib/live-prices";
import { buildWatchlistShareText } from "../../../lib/watchlist-share";
import { isFreshPriceSnapshot } from "../../../lib/price-freshness";
import type { Product, ServerPriceResult, StockStatus, TagDefinition, WatchlistGroup } from "../../../lib/types";

type SortKey = "name" | "price" | "trend" | "lastUpdated";
type FilterKey = "all" | "in_stock" | "back_order" | "out_of_stock";

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_stock", label: "In Stock" },
  { key: "back_order", label: "Back Order" },
  { key: "out_of_stock", label: "Out of Stock" },
];



function getTrend(product: Product): "up" | "down" | "flat" {
  const listings = product.listings.filter((l) => l.priceHistory.length >= 2);
  if (!listings.length) return "flat";

  let totalPct = 0;
  let count = 0;
  for (const listing of listings) {
    const history = listing.priceHistory;
    const recent = history[history.length - 1].price;
    const older = history[Math.max(0, history.length - 3)].price;
    if (!Number.isFinite(recent) || !Number.isFinite(older) || older <= 0) continue;
    totalPct += ((recent - older) / older) * 100;
    count += 1;
  }
  if (count === 0) return "flat";
  const avgPct = totalPct / count;
  if (avgPct > 1) return "up";
  if (avgPct < -1) return "down";
  return "flat";
}

function getDominantStatus(product: Product): StockStatus {
  const statuses = product.listings.map((l) => l.stockStatus);
  if (statuses.includes("in_stock")) return "in_stock";
  if (statuses.includes("back_order")) return "back_order";
  if (statuses.includes("out_of_stock")) return "out_of_stock";
  return "unknown";
}



const MAX_CONCURRENT_SERVER_FETCHES = 3;

async function fetchServerPricesForWatchlist(): Promise<{ refreshed: number; total: number } | null> {
  if (!getApiBaseUrl()) return null;
  const products = await storage.getWatchlist();
  const jobs = products
    .filter((p) => p.listings.length > 0)
    .map((p) => ({ productId: p.id, modelNumber: p.modelNumber, listings: p.listings }));
  const total = jobs.reduce((n, j) => n + j.listings.length, 0);
  if (total === 0) return { refreshed: 0, total: 0 };
  const client = createTRPCClient();
  let refreshed = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_SERVER_FETCHES, total) }, async () => {
      while (next < jobs.length) {
        const job = jobs[next];
        next += 1;
        const results: (ServerPriceResult | null)[] = [];
        for (const listing of job.listings) {
          try {
            results.push(
              await client.prices.get.query({
                distributorId: listing.distributorId,
                modelNumber: job.modelNumber,
              }),
            );
          } catch {
            results.push(null);
          }
        }
        if (results.some((r) => r !== null)) {
          const merged = composeLiveListings(job.listings, results);
          await storage.updateProductListings(job.productId, merged);
        }
        refreshed += results.filter((r) => isFreshPriceSnapshot(r?.snapshot)).length;
      }
    }),
  );
  return { refreshed, total };
}



export function Watchlist() {
  const { products, loading, refresh } = useWatchlist();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [groupMode, setGroupMode] = useState<WatchlistGroup>("off");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState<{ current: number; total: number } | null>(null);
  const checkingRef = useRef(false);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tagDefinitions, setTagDefinitions] = useState<Record<string, TagDefinition>>({});
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any");
  const [query, setQuery] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceMinInput, setPriceMinInput] = useState("");
  const [priceMaxInput, setPriceMaxInput] = useState("");
  const priceRange = useMemo<[number, number] | undefined>(() => {
    if (priceMinInput.trim() === "" && priceMaxInput.trim() === "") return undefined;
    const min = priceMinInput.trim() === "" ? 0 : Number(priceMinInput);
    const max = priceMaxInput.trim() === "" ? Number.MAX_SAFE_INTEGER : Number(priceMaxInput);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return undefined;
    return [min, max];
  }, [priceMinInput, priceMaxInput]);
  const { toast, showToast } = useToast();
  // Bulk select + undo parity
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Derived array for Set reactivity — ensures effects trigger on mutation via new Set()
  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const selectedIdsSize = selectedIds.size;
  void selectedIdsArray;
  void selectedIdsSize;
  const [undoProduct, setUndoProduct] = useState<Product | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regions = useMemo(() => getAllRegions(), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Collapsing header: desktop equivalent of mobile Animated headerCollapse
  const [collapsed, setCollapsed] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_PALETTE[0]);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [editingTagColor, setEditingTagColor] = useState(TAG_PALETTE[0]);
  const [manageError, setManageError] = useState<string | null>(null);
  // BulkTagSheet — desktop Tailwind port of components/bulk-tag-sheet.tsx
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelectedTagIds, setBulkSelectedTagIds] = useState<string[]>([]);
  const [bulkNewTagName, setBulkNewTagName] = useState("");
  const [bulkNewTagColor, setBulkNewTagColor] = useState(TAG_PALETTE[0]);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const displayCurrency = settings?.displayCurrency ?? "USD";

  useEffect(() => {
    storage.getSettings().then((s) => {
      const defs = (s.tagDefinitions ?? {}) as Record<string, TagDefinition>;
      setTagDefinitions(defs);
      setSelectedTagIds((prev) => prev.filter((id) => Object.prototype.hasOwnProperty.call(defs, id)));
      setInStockOnly(s.watchlistInStockOnly ?? false);
      setGroupMode(s.watchlistGroup ?? "off");
      setSortKey(s.watchlistSortKey ?? "name");
      setSortAsc(s.watchlistSortAsc ?? true);
      const storedRange = s.watchlistPriceRange ?? null;
      if (storedRange && Array.isArray(storedRange) && storedRange.length === 2) {
        const [min, max] = storedRange;
        setPriceMinInput(min === 0 ? "" : String(min));
        setPriceMaxInput(max === Number.MAX_SAFE_INTEGER ? "" : String(max));
      }
    });
  }, [settings]);

  useEffect(() => {
    if (loading) return;
    storage
      .getSettings()
      .then((s) => storage.saveSettings({ ...s, watchlistInStockOnly: inStockOnly, watchlistPriceRange: priceRange ?? null, watchlistGroup: groupMode, watchlistSortKey: sortKey, watchlistSortAsc: sortAsc }))
      .catch(() => {});
  }, [inStockOnly, priceRange, groupMode, sortKey, sortAsc, loading]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setCollapsed(el.scrollTop > 40);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [loading]);

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
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
      }),
    [products, regionFilter, selectedTagIds, tagMatchMode, filter, query, priceRange, inStockOnly, displayCurrency],
  );

  const summary = useMemo(
    () => computeWatchlistSummary(products, displayCurrency),
    [products, displayCurrency],
  );

  const tagCounts = useMemo(
    () =>
      countTagMatches(
        filterWatchlist(products, {
          region: regionFilter,
          tagIds: selectedTagIds,
          tagMatchMode,
          status: filter as StatusFilter,
          query,
          priceRange,
          inStockOnly,
          displayCurrency,
        }),
        { region: "all", status: "all", query: "" },
      ),
    [products, regionFilter, selectedTagIds, tagMatchMode, filter, query, inStockOnly, priceRange, displayCurrency],
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "price": {
          const aPrice = getBestPrice(a.listings, displayCurrency)?.price ?? null;
          const bPrice = getBestPrice(b.listings, displayCurrency)?.price ?? null;
          if (aPrice === null && bPrice === null) cmp = 0;
          else if (aPrice === null) return 1;
          else if (bPrice === null) return -1;
          else cmp = aPrice - bPrice;
          break;
        }
        case "trend": {
          const order = { up: 0, flat: 1, down: 2 };
          cmp = order[getTrend(a)] - order[getTrend(b)];
          break;
        }
        case "lastUpdated": {
          const aTime = new Date(a.lastRefreshed ?? a.addedAt).getTime();
          const bTime = new Date(b.lastRefreshed ?? b.addedAt).getTime();
          cmp = aTime - bTime;
          break;
        }
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortAsc, displayCurrency]);

  const sections = useMemo(
    () => groupWatchlist(sorted, groupMode, tagDefinitions),
    [sorted, groupMode, tagDefinitions],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Attempt live price refresh via Tauri backend when available.
      let viaTauri = false;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const raw = await storage.getWatchlist();
        const products = raw
          .map((p) => ({
            id: p.id,
            model_number: p.modelNumber,
            distributor_ids: p.listings.map((l) => l.distributorId),
          }))
          .filter((p) => p.distributor_ids.length > 0);
        if (products.length > 0) {
          await invoke("check_all_prices", {
            products,
            apiBaseUrl: getApiBaseUrl(),
          });
          viaTauri = true;
        }
      } catch {
        // Not in Tauri or invoke unavailable — fall through to server fetch
      }
      if (viaTauri) {
        await refresh();
        showToast("Watchlist refreshed");
      } else {
        let result: { refreshed: number; total: number } | null = null;
        let fetchFailed = false;
        try {
          result = await fetchServerPricesForWatchlist();
        } catch {
          fetchFailed = true;
        }
        await refresh();
        if (fetchFailed || (result && result.refreshed === 0)) {
          showToast("Couldn't refresh prices");
        } else if (!result) {
          showToast("Live prices need a server connection or the Tauri app");
        } else {
          showToast(`Refreshed ${result.refreshed} of ${result.total} prices`);
        }
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleShare = useCallback(async () => {
    if (products.length === 0) return;
    const message = buildWatchlistShareText({ watchlist: products, displayCurrency, days: 30, now: Date.now() });
    try {
      await navigator.clipboard.writeText(message);
      showToast("Copied to clipboard");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = message;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        showToast("Copied to clipboard");
      } catch {
        showToast("Couldn't copy share text");
      }
      document.body.removeChild(ta);
    }
  }, [products, displayCurrency]);

  const handleCheckNow = useCallback(async () => {
    if (checkingRef.current || products.length === 0) return;
    checkingRef.current = true;
    setChecking(true);
    setCheckProgress({ current: 0, total: products.length });
    try {
      const { checkPriceDropsNow } = await import("../../../lib/background-price-check");
      await checkPriceDropsNow((current, total) => setCheckProgress({ current, total }));
      await refresh();
    } catch {
      showToast("Couldn't complete price check");
    } finally {
      checkingRef.current = false;
      setChecking(false);
      setCheckProgress(null);
    }
  }, [products.length, refresh]);

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
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Remove ${ids.length} product${ids.length !== 1 ? "s" : ""} from watchlist?`)) return;
    for (const id of ids) await storage.removeFromWatchlist(id);
    await refresh();
    exitSelection();
    showToast(`Removed ${ids.length} product${ids.length !== 1 ? "s" : ""}`);
  };

  const showUndoBar = (product: Product) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoProduct(product);
    undoTimer.current = setTimeout(() => setUndoProduct(null), 5000);
  };
  const handleUndo = async () => {
    if (!undoProduct) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await storage.addToWatchlist(undoProduct);
    setUndoProduct(null);
    await refresh();
    showToast("Restored " + undoProduct.name);
  };
  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const handleRemove = async (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    const product = products.find((p) => p.id === productId);
    if (!window.confirm("Remove this product from your watchlist?")) return;
    await storage.removeFromWatchlist(productId);
    await refresh();
    if (product) showUndoBar(product);
    else showToast("Removed from watchlist");
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {!selectionMode ? (
          <button
            type="button"
            onClick={() => setSelectionMode(true)}
            aria-label="Enter bulk select mode"
          >
            Select
          </button>
        ) : (
          <button type="button" onClick={exitSelection}>
            Cancel
          </button>
        )}
        <LoadingSpinner size="large" label="Loading watchlist..." />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="p-6 space-y-4">
        {!selectionMode ? (
          <button
            type="button"
            onClick={() => setSelectionMode(true)}
            aria-label="Enter bulk select mode"
          >
            Select
          </button>
        ) : (
          <button type="button" onClick={exitSelection}>
            Cancel
          </button>
        )}
        <EmptyState
          icon={<Package className="w-8 h-8" />}
          title="No products in watchlist"
          description="Search for products to start tracking prices and stock availability."
          action={{ label: "Add products", to: "/search" }}
        />
      </div>
    );
  }

  // TagManageSheet — desktop Tailwind port of components/tag-manage-sheet.tsx (create/edit color+name/delete with cascade)
  const refreshTagDefs = async () => {
    const defs = await storage.getTagDefinitions();
    setTagDefinitions(defs as Record<string, TagDefinition>);
    setSelectedTagIds((prev) => prev.filter((id) => Object.prototype.hasOwnProperty.call(defs, id)));
  };
  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setManageError(null);
    try {
      await storage.createTag(name, newTagColor);
      await refreshTagDefs();
      setNewTagName("");
      setNewTagColor(nextTagColor(await storage.getTagDefinitions()));
      showToast(`Tag "${name}" created`);
    } catch (e) {
      setManageError(e instanceof Error ? e.message : "Could not create tag");
    }
  };
  const handleUpdateTag = async () => {
    if (!editingTagId) return;
    const name = editingTagName.trim();
    if (!name) return;
    setManageError(null);
    try {
      await storage.renameTag(editingTagId, name);
      if (editingTagColor !== tagDefinitions[editingTagId]?.color) {
        await storage.setTagColor(editingTagId, editingTagColor);
      }
      await refreshTagDefs();
      setEditingTagId(null);
      showToast("Tag updated");
    } catch (e) {
      setManageError(e instanceof Error ? e.message : "Could not update tag");
    }
  };
  const handleRecolorTag = async (id: string, color: string) => {
    try {
      await storage.setTagColor(id, color);
      await refreshTagDefs();
    } catch (e) {
      setManageError(e instanceof Error ? e.message : "Could not recolor tag");
    }
  };
  const handleDeleteTag = async (id: string) => {
    const def = tagDefinitions[id];
    if (!def) return;
    if (!window.confirm(`Delete "${def.name}"? It will be removed from all products.`)) return;
    setManageError(null);
    try {
      await storage.deleteTag(id);
      await refreshTagDefs();
      await refresh();
      showToast("Tag deleted");
    } catch (e) {
      setManageError(e instanceof Error ? e.message : "Could not delete tag");
    }
  };

  // BulkTagSheet — desktop Tailwind port of components/bulk-tag-sheet.tsx (assign tags to selection)
  const toggleBulkTag = (tagId: string) => {
    setBulkSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((i) => i !== tagId) : [...prev, tagId]));
  };
  const handleBulkCreateTag = async () => {
    const name = bulkNewTagName.trim();
    if (!name) return;
    setBulkError(null);
    try {
      const current = await storage.getTagDefinitions();
      const tag = await storage.createTag(name, bulkNewTagColor);
      setTagDefinitions((prev) => ({ ...prev, [tag.id]: tag }));
      setBulkSelectedTagIds((prev) => [...prev, tag.id]);
      setBulkNewTagName("");
      setBulkNewTagColor(nextTagColor({ ...current, [tag.id]: tag }));
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Could not create tag");
    }
  };
  const handleBulkApply = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || bulkSelectedTagIds.length === 0) return;
    setBulkError(null);
    try {
      await storage.addTagsToProducts(ids, bulkSelectedTagIds);
      await refresh();
      await refreshTagDefs();
      setBulkOpen(false);
      setBulkSelectedTagIds([]);
      exitSelection();
      showToast(`Added ${bulkSelectedTagIds.length} tag${bulkSelectedTagIds.length !== 1 ? "s" : ""} to ${ids.length} product${ids.length !== 1 ? "s" : ""}`);
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Could not apply tags");
    }
  };
  const openBulkTagSheet = async () => {
    try {
      const defs = await storage.getTagDefinitions();
      setTagDefinitions(defs as Record<string, TagDefinition>);
    } catch {}
    setBulkSelectedTagIds([]);
    setBulkNewTagName("");
    setBulkError(null);
    setBulkNewTagColor(nextTagColor(tagDefinitions));
    setBulkOpen(true);
  };

  const renderRow = (product: Product) => {
    const best = getBestPrice(product.listings, displayCurrency);
    const trend = getTrend(product);
    const refreshed = product.lastRefreshed ?? product.addedAt;

    return (
      <tr
        key={product.id}
        onClick={() => {
          if (selectionMode) {
            toggleSelection(product.id);
            return;
          }
          setSelectedId(product.id);
          navigate(`/product/${product.id}`);
        }}
        className={`border-b border-gray-100 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors duration-150 ${selectedId === product.id ? "bg-brand-50 dark:bg-brand-900/10 border-l-2 border-l-brand-500" : "border-l-2 border-l-transparent hover:border-l-brand-200"} ${selectedIds.has(product.id) ? "bg-brand-50/60 dark:bg-brand-900/20" : ""}`}
      >
        {selectionMode && (
          <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selectedIds.has(product.id)}
              onChange={() => toggleSelection(product.id)}
              className="rounded border-gray-300"
              aria-label={`Select ${product.name}`}
            />
          </td>
        )}
        <td className="px-4 py-3">
          <div className="flex items-center">
            <ProductImage productId={product.id} />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-medium text-sm">{product.name}</p>
                {(product.tags ?? [])
                  .filter((tagId) => tagDefinitions[tagId])
                  .map((tagId) => {
                    const def = tagDefinitions[tagId];
                    return (
                      <span
                        key={tagId}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: def.color }}
                        title={def.name}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                        {def.name}
                      </span>
                    );
                  })}
                {(product.tags ?? []).filter((id) => tagDefinitions[id]).length === 0 &&
                  product.tags &&
                  product.tags.length > 0 && (
                    <span className="text-[10px] text-gray-400">
                      · {product.tags.length} tag
                      {product.tags.length !== 1 ? "s" : ""}
                    </span>
                  )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {product.brand} · {product.modelNumber}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
          {product.listings.length}
        </td>
        <td className="px-4 py-3">
          {best ? (
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {formatPrice(best.price, best.currency)}
            </span>
          ) : (
            <span className="text-sm text-gray-400">No price</span>
          )}
        </td>
        <td className="px-4 py-3">
          <StockBadge status={getDominantStatus(product)} />
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1 text-sm">
            {trend === "up" && <TrendingUp className="w-4 h-4 text-red-500" />}
            {trend === "down" && (
              <TrendingDown className="w-4 h-4 text-emerald-500" />
            )}
            {trend === "flat" && <Minus className="w-4 h-4 text-gray-400" />}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {formatLastRefreshed(refreshed)}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={(e) => handleRemove(e, product.id)}
            onKeyDown={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label={`Remove ${product.name} from watchlist`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="p-6 space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 animate-fadeIn">
          {toast}
        </div>
      )}
      {/* WatchlistHeader — collapsing sticky header (sole H1; legacy static header removed) */}
      <div
        className={`sticky top-0 z-10 -mx-6 -mt-6 px-6 pt-6 pb-3 bg-[#F8FAFC] dark:bg-[#0A0E1A] border-b transition-all duration-200 ${collapsed ? "shadow-sm py-3" : "border-transparent"}`}
        style={{ opacity: collapsed ? 0.97 : 1, transform: collapsed ? "translateY(-1px)" : "translateY(0)" }}
      >
        <div className="flex items-center justify-between">
          <div className={collapsed ? "transition-all duration-200 scale-[0.96] origin-left" : "transition-all duration-200"}>
            <h1 className={`font-bold transition-all duration-200 ${collapsed ? "text-lg" : "text-2xl"}`}>Watchlist</h1>
            <p className={`text-gray-500 dark:text-gray-400 transition-all duration-200 ${collapsed ? "text-xs" : "text-sm"}`}>
              {products.length} product{products.length !== 1 ? "s" : ""} tracked
              {filtered.length !== products.length ? ` · ${filtered.length} shown` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {!selectionMode ? (
              <button
                onClick={() => setSelectionMode(true)}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
                aria-label="Enter bulk select mode"
              >
                Select
              </button>
            ) : (
              <>
                <span className="text-sm text-gray-600 dark:text-gray-300">{selectedIds.size} selected</span>
                <button onClick={openBulkTagSheet} disabled={selectedIds.size === 0} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-50">
                  <TagIcon className="w-3.5 h-3.5" /> Tag
                </button>
                <button onClick={handleBulkDelete} disabled={selectedIds.size === 0} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50">Delete</button>
                <button onClick={exitSelection} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">Cancel</button>
              </>
            )}
            <button
              onClick={() => navigate("/distributor-analysis")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="View distributor analysis"
            >
              Distributor Analysis
            </button>
            <button
              onClick={handleShare}
              disabled={refreshing || products.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium disabled:opacity-50"
              aria-label="Share watchlist"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              onClick={handleCheckNow}
              disabled={refreshing || checking || products.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium disabled:opacity-50"
              aria-label="Check prices now"
            >
              <Zap className="w-4 h-4" />
              Check Now
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium disabled:opacity-50"
              aria-label="Refresh prices"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={() => setManageOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
              aria-label="Manage tags"
            >
              <Settings2 className="w-4 h-4" /> Manage Tags
            </button>
            {checking && checkProgress && (
              <span className="text-xs text-gray-500">Checking {checkProgress.current}/{checkProgress.total}</span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Total Value
          </span>
          <span className="text-2xl font-bold">
            {formatPrice(summary.totalValue, displayCurrency)}
          </span>
        </div>
        <div className="flex gap-4 mt-3">
          <div className="flex-1">
            <p className="text-lg font-semibold text-emerald-600">
              {summary.inStock}
            </p>
            <p className="text-xs text-gray-500">In Stock</p>
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-amber-600">
              {summary.backOrder}
            </p>
            <p className="text-xs text-gray-500">Back Order</p>
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-red-600">
              {summary.outOfStock}
            </p>
            <p className="text-xs text-gray-500">Out of Stock</p>
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold">{summary.listingCount}</p>
            <p className="text-xs text-gray-500">Listings</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === opt.key
                ? "bg-brand-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            aria-label={`Filter by ${opt.label}`}
          >
            {opt.label}
          </button>
        ))}
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="rounded border-gray-300"
            aria-label="In stock only"
          />
          In stock only
        </label>
        <input
          type="number"
          value={priceMinInput}
          onChange={(e) => setPriceMinInput(e.target.value)}
          placeholder="Min"
          inputMode="decimal"
          aria-label="Minimum price"
          className="w-20 px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-600"
        />
        <input
          type="number"
          value={priceMaxInput}
          onChange={(e) => setPriceMaxInput(e.target.value)}
          placeholder="Max"
          inputMode="decimal"
          aria-label="Maximum price"
          className="w-20 px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-600"
        />
        <select
          value={groupMode}
          onChange={(e) => setGroupMode(e.target.value as WatchlistGroup)}
          aria-label="Group by"
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-600"
        >
          <option value="off">Group: Off</option>
          <option value="tag">Group: Tag</option>
          <option value="status">Group: Status</option>
          <option value="region">Group: Region</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", ...regions].map((region) => (
          <button
            key={region}
            onClick={() => setRegionFilter(region)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              regionFilter === region
                ? "bg-brand-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            aria-label={region === "all" ? "Filter by all regions" : `Filter by ${region} region`}
          >
            {region === "all" ? "All" : region}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <TagFilterRow
            tagDefinitions={tagDefinitions}
            selectedTagIds={selectedTagIds}
            tagMatchMode={tagMatchMode}
            counts={tagCounts}
            onToggleTag={toggleTagFilter}
            onChangeMode={setTagMatchMode}
            onClearAll={() => setSelectedTagIds([])}
          />
        </div>
        {Object.keys(tagDefinitions).length > 0 && (
          <button
            onClick={() => setManageOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0"
            aria-label="Manage tags"
          >
            <TagIcon className="w-3 h-3" /> Manage
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or model number..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
          aria-label="Search watchlist"
        />
      </div>

      <div
        ref={scrollRef}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[60vh] overflow-y-auto"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {selectionMode && <th className="px-2 py-3 w-8"><span className="sr-only">Select</span></th>}
              <th className="text-left">
                <button
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-1 px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 w-full"
                  aria-label="Sort by Name"
                >
                  Name
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                Listings
              </th>
              <th className="text-left">
                <button
                  onClick={() => handleSort("price")}
                  className="flex items-center gap-1 px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 w-full"
                  aria-label="Sort by Price"
                >
                  Price
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                Stock
              </th>
              <th className="text-left">
                <button
                  onClick={() => handleSort("trend")}
                  className="flex items-center gap-1 px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 w-full"
                  aria-label="Sort by Trend"
                >
                  Trend
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-left">
                <button
                  onClick={() => handleSort("lastUpdated")}
                  className="flex items-center gap-1 px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 w-full"
                  aria-label="Sort by Last Updated"
                >
                  Last Updated
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {groupMode === "off"
              ? sorted.map((product) => renderRow(product))
              : sections.map((section) => (
                  <Fragment key={section.key}>
                    <tr>
                      <th scope="rowgroup" colSpan={selectionMode ? 8 : 7} className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/60 text-left">
                        {section.title} · {section.products.length}
                      </th>
                    </tr>
                    {section.products.map((product) => renderRow(product))}
                  </Fragment>
                ))}
          </tbody>
          </table>
        </div>

        {sorted.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400 space-y-3">
            <p>No products match this filter.</p>
            {products.length > 0 && (
              <button
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                  setRegionFilter("all");
                  setSelectedTagIds([]);
                  setInStockOnly(false);
                  setPriceMinInput("");
                  setPriceMaxInput("");
                }}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                aria-label="Clear all filters"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
      {undoProduct && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50">
          <span>Removed {undoProduct.name}</span>
          <button onClick={handleUndo} className="px-3 py-1 rounded-lg bg-white text-gray-900 text-xs font-semibold hover:bg-gray-100">Undo</button>
          <button onClick={() => setUndoProduct(null)} className="p-1 rounded hover:bg-white/10" aria-label="Dismiss undo">×</button>
        </div>
      )}
      {manageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setManageOpen(false); setEditingTagId(null); setManageError(null); }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><TagIcon className="w-4 h-4" /> Manage Tags</h3>
              <button onClick={() => { setManageOpen(false); setEditingTagId(null); setManageError(null); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
            </div>
            {manageError && <p className="text-xs text-red-600 dark:text-red-400 mb-3">{manageError}</p>}
            <div className="space-y-3 mb-4 max-h-[360px] overflow-y-auto pr-1">
              {Object.values(tagDefinitions).map((def) => (
                <div key={def.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  {editingTagId === def.id ? (
                    <div className="flex items-center gap-2 mb-2">
                      <input type="color" value={editingTagColor} onChange={(e) => setEditingTagColor(e.target.value)} className="w-8 h-8 rounded border shrink-0" aria-label="Tag color" />
                      <input value={editingTagName} maxLength={24} onChange={(e) => setEditingTagName(e.target.value)} className="flex-1 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" placeholder="Tag name" />
                      <button onClick={handleUpdateTag} className="px-2.5 py-1 rounded bg-brand-600 text-white text-xs font-medium">Save</button>
                      <button onClick={() => { setEditingTagId(null); setManageError(null); }} className="px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: def.color }} />
                      <span className="flex-1 text-sm font-medium truncate">{def.name}</span>
                      <button onClick={() => { setEditingTagId(def.id); setEditingTagName(def.name); setEditingTagColor(def.color); setManageError(null); }} className="text-xs font-medium text-brand-600 hover:underline">Edit</button>
                      <button onClick={() => handleDeleteTag(def.id)} className="text-xs font-medium text-red-600 hover:underline">Delete</button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {TAG_PALETTE.map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          if (editingTagId === def.id) setEditingTagColor(color);
                          else void handleRecolorTag(def.id, color);
                        }}
                        className={`w-6 h-6 rounded-full border-2 ${ (editingTagId === def.id ? editingTagColor : def.color) === color ? "border-gray-900 dark:border-white" : "border-transparent"}`}
                        style={{ backgroundColor: color }}
                        aria-label={`Set color to ${color}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(tagDefinitions).length === 0 && <p className="text-sm text-gray-500">No tags yet. Create one below.</p>}
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-xs font-semibold mb-2">Create new tag</p>
              <div className="flex items-center gap-2 mb-2">
                <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="w-8 h-8 rounded border shrink-0" aria-label="New tag color" />
                <input value={newTagName} maxLength={24} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag name" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
                <button onClick={handleCreateTag} disabled={!newTagName.trim()} className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-50">Add</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TAG_PALETTE.map((c) => (
                  <button key={c} onClick={() => setNewTagColor(c)} className={`w-6 h-6 rounded-full border-2 ${newTagColor === c ? "border-gray-900 dark:border-white" : "border-transparent"}`} style={{ backgroundColor: c }} aria-label={`Pick color ${c}`} />
                ))}
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => { setManageOpen(false); setEditingTagId(null); setManageError(null); }} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium">Close</button>
            </div>
          </div>
        </div>
      )}
      {/* BulkTagSheet — assign tags to selection */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setBulkOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold flex items-center gap-2"><TagIcon className="w-4 h-4" /> Add Tags</h3>
              <button onClick={() => setBulkOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Apply to {selectedIds.size} product{selectedIds.size !== 1 ? "s" : ""}</p>
            {bulkError && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{bulkError}</p>}
            <div className="space-y-1 mb-4 max-h-[260px] overflow-y-auto">
              {Object.keys(tagDefinitions).length === 0 && <p className="text-sm text-gray-500">No tags yet — create one below.</p>}
              {Object.values(tagDefinitions).map((tag) => {
                const active = bulkSelectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleBulkTag(tag.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left ${active ? "bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40"}`}
                  >
                    <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${active ? "bg-brand-600 border-brand-600 text-white" : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"}`}>{active ? "✓" : ""}</span>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    <span className="text-sm font-medium truncate">{tag.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
              <div className="flex items-center gap-2">
                <input type="color" value={bulkNewTagColor} onChange={(e) => setBulkNewTagColor(e.target.value)} className="w-8 h-8 rounded border shrink-0" aria-label="New tag color" />
                <input value={bulkNewTagName} maxLength={24} onChange={(e) => setBulkNewTagName(e.target.value)} placeholder="New tag name" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
                <button onClick={handleBulkCreateTag} disabled={!bulkNewTagName.trim()} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium disabled:opacity-50">Create</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TAG_PALETTE.map((c) => (
                  <button key={c} onClick={() => setBulkNewTagColor(c)} className={`w-5 h-5 rounded-full border-2 ${bulkNewTagColor === c ? "border-gray-900 dark:border-white" : "border-transparent"}`} style={{ backgroundColor: c }} aria-label={`Pick ${c}`} />
                ))}
              </div>
              <button onClick={handleBulkApply} disabled={bulkSelectedTagIds.length === 0} className="w-full mt-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold disabled:opacity-50">
                Add {bulkSelectedTagIds.length > 0 ? `${bulkSelectedTagIds.length} tag${bulkSelectedTagIds.length !== 1 ? "s" : ""} ` : ""}to selected
              </button>
            </div>
            <div className="flex justify-center mt-3">
              <button onClick={() => setBulkOpen(false)} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
