import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "react-router";
import { storage } from "../storage";
import { useToast } from "../hooks/use-toast";
import { formatPrice } from "@shared/currency";
import { convertPrice } from "@/lib/currency";
import { DISTRIBUTORS, getDistributorById } from "@shared/distributors";
import type { Product, PriceAlert } from "../../../lib/types";
import { buildShareText } from "../../../lib/price-share";
import { priceHistoryToCsv } from "../../../lib/csv";
import { copyTextWithFallback, saveNodeAsPng } from "../lib/share";
import { saveCsv } from "../lib/save-csv";
import { checkNotificationPermission } from "../lib/notification-permission";
import { StockBadge } from "../components/StockBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { SeriesChart } from "../components/compare/SeriesChart";
import { CompareHeader } from "../components/compare/CompareHeader";
import { CheapestByRegion } from "../components/compare/CheapestByRegion";
import { DistributorSelector } from "../components/compare/DistributorSelector";
import { CompareDistributorList } from "../components/compare/CompareDistributorList";
import { filterByRange, cheapestByRegion, distributorColor, type TimeRange } from "@shared/compare-utils";
import {
  GitCompareArrows,
  TrendingDown,
} from "lucide-react";

function toTimeRange(k: string): TimeRange {
  switch (k) {
    case "1w":
      return "1W";
    case "1m":
      return "1M";
    case "3m":
      return "3M";
    case "6m":
      return "6M";
    case "1y":
      return "1Y";
    default:
      return "All";
  }
}

export function Compare() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("3m");
  const [sortBy, setSortBy] = useState<"name" | "price" | "trend">("name");
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(() => {
    const d = searchParams.get("distributor");
    return new Set(d ? [d] : []);
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  // Guards against a double-click creating two identical cross-distributor alerts.
  const [creatingAlert, setCreatingAlert] = useState(false);
  const selectionInitialized = useRef<string | null>(null);
  const lastAppliedParam = useRef<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const distributorParam = searchParams.get("distributor");
  const { toast, showToast } = useToast();

  const loadCompare = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [list, settings] = await Promise.all([
        storage.getWatchlist(),
        storage.getSettings(),
      ]);
      setProduct(list.find((p) => p.id === id) ?? null);
      if (settings?.displayCurrency) setDisplayCurrency(settings.displayCurrency);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load comparison");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadCompare();
    });
  }, [loadCompare]);

  useEffect(() => {
    if (!product) return;
    const paramKey = `${product.id}|${distributorParam ?? ""}`;
    if (distributorParam && (product.listings ?? []).some((l) => l.distributorId === distributorParam)) {
      if (lastAppliedParam.current !== paramKey) {
        lastAppliedParam.current = paramKey;
        selectionInitialized.current = product.id;
        setSelected(new Set([distributorParam]));
      }
      return;
    }
    if (selectionInitialized.current === product.id) return;
    selectionInitialized.current = product.id;
    const withHistory = (product.listings ?? [])
      .filter((l) => l.priceHistory && l.priceHistory.length >= 2)
      .sort((a, b) => {
        // Null-safe: the raw-price fallback mixed currencies when a rate was
        // unavailable (mobile sorts unconvertible listings last).
        const aConv = convertPrice(a.price, a.currency, displayCurrency);
        const bConv = convertPrice(b.price, b.currency, displayCurrency);
        if (aConv === null && bConv === null) return 0;
        if (aConv === null) return 1;
        if (bConv === null) return -1;
        return aConv - bConv;
      });
    setSelected(new Set(withHistory.slice(0, 3).map((l) => l.distributorId)));
  }, [product, displayCurrency, distributorParam]);

  const toggleSelect = useCallback((distributorId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(distributorId)) {
        next.delete(distributorId);
      } else if (next.size < 5) {
        next.add(distributorId);
      }
      return next;
    });
  }, []);
  const handleToggleSelect = useCallback(
    (distributorId: string) => {
      // Mobile shows a toast when the 5-distributor cap is hit; desktop
      // silently ignored the click.
      if (!selected.has(distributorId) && selected.size >= 5) {
        showToast("You can compare up to 5 distributors");
        return;
      }
      toggleSelect(distributorId);
    },
    [selected, toggleSelect, showToast],
  );

  const timeRangeTyped = useMemo(() => toTimeRange(timeRange), [timeRange]);

  const chartSeries = useMemo(() => {
    if (!product) return [];
    const range = timeRangeTyped;
    const selectedIds = selected;
    const list = (product.listings ?? []).filter(
      (l) =>
        selectedIds.has(l.distributorId) &&
        l.priceHistory &&
        l.priceHistory.length >= 2,
    );
    return list.map((l) => {
      const distributor = getDistributorById(l.distributorId);
      const filtered = filterByRange(l.priceHistory, range);
      return {
        label: distributor?.name ?? l.distributorId,
        color: distributorColor(l.distributorId),
        data: filtered as { price: number; currency: string; date: string }[],
      };
    });
  }, [product, timeRangeTyped, selected]);

  const priceTrends = useMemo(() => {
    if (!product) return new Map<string, { pct: number; dir: "up" | "down" | "flat" }>();
    const map = new Map<string, { pct: number; dir: "up" | "down" | "flat" }>();
    for (const l of product.listings ?? []) {
      if (!l.priceHistory || l.priceHistory.length < 2) {
        map.set(l.distributorId, { pct: 0, dir: "flat" });
        continue;
      }
      const sorted = [...l.priceHistory].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      const oldest = sorted[0].price;
      const current = l.price;
      const pct = oldest > 0 ? ((current - oldest) / oldest) * 100 : 0;
      map.set(l.distributorId, {
        pct: Math.abs(pct),
        dir: pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat",
      });
    }
    return map;
  }, [product]);

  const sortedListings = useMemo(() => {
    if (!product) return [];
    const listings = (product.listings ?? []).map((l) => {
      const dist = DISTRIBUTORS.find((d) => d.id === l.distributorId);
      return { ...l, distName: dist?.name ?? l.distributorId, dist };
    });
    if (sortBy === "price") {
      return listings.sort((a, b) => {
        // Null-safe: falling back to the raw price mixed currencies when a
        // listing's rate was unavailable (mobile sorts those last).
        const pa = convertPrice(a.price, a.currency, displayCurrency);
        const pb = convertPrice(b.price, b.currency, displayCurrency);
        if (pa === null && pb === null) return 0;
        if (pa === null) return 1;
        if (pb === null) return -1;
        return pa - pb;
      });
    }
    if (sortBy === "trend") {
      return listings.sort((a, b) => {
        const ta = priceTrends.get(a.distributorId);
        const tb = priceTrends.get(b.distributorId);
        const scoreA =
          ta?.dir === "down" ? ta.pct : ta?.dir === "up" ? -ta.pct : 0;
        const scoreB =
          tb?.dir === "down" ? tb.pct : tb?.dir === "up" ? -tb.pct : 0;
        return scoreB - scoreA;
      });
    }
    return listings.sort((a, b) => a.distName.localeCompare(b.distName));
  }, [product, sortBy, displayCurrency, priceTrends]);

  const cheapest = useMemo(() => {
    if (!sortedListings.length) return null;
    const inStock = sortedListings.filter(
      (l) => l.stockStatus !== "out_of_stock" && l.price > 0,
    );
    if (!inStock.length) return null;
    // Skip listings whose currency can't be converted rather than falling back
    // to the raw price, which mixed currencies in the comparison.
    const convertible = inStock.filter(
      (l) => convertPrice(l.price, l.currency, displayCurrency) !== null,
    );
    if (!convertible.length) return null;
    return convertible.reduce((best, curr) => {
      const currConv = convertPrice(curr.price, curr.currency, displayCurrency)!;
      const bestConv = convertPrice(best.price, best.currency, displayCurrency)!;
      return currConv < bestConv ? curr : best;
    });
  }, [sortedListings, displayCurrency]);

  const regionBest = useMemo(
    () => cheapestByRegion(sortedListings, displayCurrency, convertPrice),
    [sortedListings, displayCurrency],
  );

  const crossBest = useMemo(() => {
    const inStock = sortedListings.filter((l) => l.stockStatus === "in_stock");
    if (inStock.length === 0) return null;
    const vals = inStock
      .map((l) => convertPrice(l.price, l.currency, displayCurrency))
      .filter((v): v is number => v !== null && Number.isFinite(v));
    if (vals.length === 0) return null;
    return Math.min(...vals);
  }, [sortedListings, displayCurrency]);

  const alertTarget = useMemo(
    () => (crossBest === null ? null : Math.round(crossBest * 0.95 * 100) / 100),
    [crossBest],
  );

  const handleCrossAlert = useCallback(async () => {
    if (!id || !product || alertTarget === null || creatingAlert) return;
    // Mobile's compare cross-alert checks notification permission first; without
    // it the alert is saved but can never notify.
    const granted = await checkNotificationPermission();
    if (!granted) {
      showToast("Enable notifications to receive price alerts.");
      return;
    }
    const alert: PriceAlert = {
      id: `cross-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: id,
      distributorId: undefined,
      targetPrice: alertTarget,
      currency: displayCurrency,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    setCreatingAlert(true);
    try {
      await storage.addAlert(alert);
    } catch {
      showToast("Couldn't create alert. Please try again.");
      return;
    } finally {
      setCreatingAlert(false);
    }
    showToast(`Alert set below ${formatPrice(alertTarget, displayCurrency)}`);
  }, [id, product, alertTarget, displayCurrency, creatingAlert, showToast]);

  const handleShareCompare = useCallback(async () => {
    if (!product) return;
    const message = `${buildShareText({ product, listings: sortedListings, displayCurrency, limit: 5 })}\n\n${window.location.origin}/#/compare/${product.id}`;
    if (await copyTextWithFallback(message)) showToast("Copied to clipboard");
    else showToast("Couldn't copy share text");
  }, [product, sortedListings, displayCurrency, showToast]);

  const handleSaveImage = useCallback(async () => {
    if (!chartRef.current || !product) return;
    try {
      await saveNodeAsPng(chartRef.current, `compare-${product.id}.png`);
      showToast("Comparison image saved");
    } catch {
      showToast("Couldn't save comparison image");
    }
  }, [product, showToast]);

  // Mobile's compare screen exports the price history as CSV; desktop's had only
  // Share / Save image.
  const handleExportCsv = useCallback(async () => {
    if (!product) return;
    // Mobile refuses to export when no listing has history ("Nothing to
    // export"); without this the desktop wrote a header-only CSV and reported
    // success.
    const withHistory = sortedListings.filter(
      (l) => l.priceHistory && l.priceHistory.length > 0,
    );
    if (withHistory.length === 0) {
      showToast("Nothing to export — no price history yet");
      return;
    }
    try {
      const rows = withHistory
        .flatMap((l) =>
          (l.priceHistory ?? []).map((pt) => ({
            ...pt,
            distributor: getDistributorById(l.distributorId)?.name ?? l.distributorId,
          })),
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const csv = priceHistoryToCsv(rows, {
        name: product.name,
        modelNumber: product.modelNumber ?? product.id,
      });
      const fileName = `${product.id}-price-history-${new Date().toISOString().slice(0, 10)}.csv`;
      const result = await saveCsv(fileName, csv);
      if (result.status === "cancelled") return;
      if (result.status === "failed") {
        showToast("Couldn't export the price history");
        return;
      }
      showToast(result.path ? `Exported to ${result.path}` : "Price history exported");
    } catch {
      showToast("Couldn't export the price history");
    }
  }, [product, sortedListings, showToast]);

  const getTrend = (priceHistory: { price: number; date: string }[] | undefined) => {
    if (!priceHistory || priceHistory.length < 2) return "flat";
    const recent = priceHistory[priceHistory.length - 1].price;
    const prev = priceHistory[priceHistory.length - 2].price;
    if (recent < prev) return "down";
    if (recent > prev) return "up";
    return "flat";
  };

  if (loading) return <LoadingSpinner size="large" label="Loading prices..." />;
  if (loadError)
    return (
      <div className="p-6 space-y-6">
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <span className="flex-1">Couldn&apos;t load comparison: {loadError}</span>
          <button
            onClick={() => void loadCompare()}
            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
            aria-label="Retry loading comparison"
          >
            Retry
          </button>
        </div>
      </div>
    );
  if (!product)
    return (
      <EmptyState
        icon={<GitCompareArrows className="w-12 h-12" />}
        title="Product not found"
        description="Go back to your watchlist and try again."
        action={{ label: "Back to watchlist", to: "/watchlist" }}
      />
    );

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm" role="status">
          {toast}
        </div>
      )}
      <CompareHeader
        product={product}
        loading={loading}
        timeRange={timeRange}
        onTimeRange={setTimeRange}
        onRefresh={() => void loadCompare()}
        onShare={() => void handleShareCompare()}
        onSaveImage={() => void handleSaveImage()}
        onExportCsv={() => void handleExportCsv()}
      />

      {cheapest && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-800">
              <TrendingDown className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                Best Price: {cheapest.distName}
              </p>
              <p className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
                {formatPrice(cheapest.price, cheapest.currency)}
              </p>
            </div>
            <div className="ml-auto">
              <StockBadge status={cheapest.stockStatus} />
            </div>
          </div>
        </div>
      )}

      <CheapestByRegion regionBest={regionBest} displayCurrency={displayCurrency} />

      {alertTarget !== null && crossBest !== null && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-semibold">Alert me if any distributor drops below</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {formatPrice(alertTarget, displayCurrency)} (5% below current best of {formatPrice(crossBest, displayCurrency)})
            </div>
          </div>
          <button
            onClick={handleCrossAlert}
            className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 shrink-0"
            aria-label="Set cross-distributor price alert"
          >
            Set alert
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Current Prices
        </h2>
        {selected.size === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-3">
            No distributors selected
          </p>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedListings
              .filter((l) => selected.has(l.distributorId))
              .map((l) => {
                const distributor = getDistributorById(l.distributorId);
                const color = distributorColor(l.distributorId);
                const converted = convertPrice(l.price, l.currency, displayCurrency);
                return (
                  <div key={l.distributorId} className="flex items-center gap-3 py-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {distributor?.countryCode} {distributor?.name ?? l.distributorId}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{distributor?.country}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-semibold">{formatPrice(l.price, l.currency)}</span>
                      {l.currency !== displayCurrency && converted !== null && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ≈ {formatPrice(converted, displayCurrency)}
                        </span>
                      )}
                      <StockBadge status={l.stockStatus} />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <DistributorSelector
        listings={sortedListings}
        selected={selected}
        priceTrends={priceTrends}
        onToggle={handleToggleSelect}
      />

      {chartSeries.length > 0 ? (
        <div ref={chartRef} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
            Price History ({displayCurrency})
          </h2>
          {/* Mobile's ChartCard shows this subtitle and range-specific hints. */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Select up to 5 distributors to overlay
          </p>
          {(timeRange === "6m" || timeRange === "1y") && (
            <p className="text-[11px] italic text-gray-500 dark:text-gray-400 mb-2">
              Showing all available history — up to 1Y retained (older points may be limited)
            </p>
          )}
          {timeRange === "all" && (
            <p className="text-[11px] italic text-gray-500 dark:text-gray-400 mb-2">
              Showing all available history
            </p>
          )}
          <SeriesChart series={chartSeries} displayCurrency={displayCurrency} />
          {chartSeries.length === 1 && (
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
              Add another distributor to compare
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center justify-center text-center">
          <div className="text-gray-300 dark:text-gray-600 mb-3">
            <GitCompareArrows className="w-10 h-10 mx-auto" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {sortedListings.filter((l) => l.priceHistory && l.priceHistory.length >= 2).length === 0
              ? "No price history yet"
              : "Select distributors to compare"}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            {sortedListings.filter((l) => l.priceHistory && l.priceHistory.length >= 2).length === 0
              ? "Price points will appear here once distributors have history. Try tracking more distributors or check back later."
              : "Use the selector above to choose up to 5 distributors with price history."}
          </p>
        </div>
      )}

      <CompareDistributorList
        listings={sortedListings}
        sortBy={sortBy}
        onSort={setSortBy}
        getTrend={getTrend}
      />
    </div>
  );
}
