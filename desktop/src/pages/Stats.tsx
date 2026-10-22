import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Share2, RefreshCw, Package, BarChart3 } from "lucide-react";
import { copyTextWithFallback, saveNodeAsPng } from "../lib/share";
import { storage } from "../storage";
import { useToast } from "../hooks/use-toast";
import { EmptyState } from "../components/EmptyState";
import { distributorColor } from "@shared/compare-utils";
import { convertPrice, getBestPrice } from "@/lib/currency";
import { DISTRIBUTORS } from "@shared/distributors";
import type { Product } from "../../../lib/types";
import { activeProducts } from "../../../lib/acquired";
import {
  computeBasketValue,
  computeDataFreshness,
  computeMovers,
  computeStockHealth,
  type MoversWindow,
} from "../../../lib/watchlist-stats";
import { computeDigest, type DigestResult } from "../../../lib/price-digest";
import { computeDropCalendar, buildGridCells } from "../../../lib/drop-calendar";
import { computeProductInsights } from "../../../lib/product-insights";
import { rankDeals } from "../../../lib/deal-score";
import { buildWatchlistShareText } from "../../../lib/watchlist-share";
import { StatsSummaryCards } from "../components/stats/StatsSummaryCards";
import { DigestCard } from "../components/stats/DigestCard";
import { ProductInsightsCard } from "../components/stats/ProductInsightsCard";
import { DropCalendarCard } from "../components/stats/DropCalendarCard";
import { PriceHistoryCard } from "../components/stats/PriceHistoryCard";
import { StatsHealthCards } from "../components/stats/StatsHealthCards";
import { BasketAlertDialog } from "../components/stats/BasketAlertDialog";



function StatSkeleton() {
  return (
    <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse">
      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded skeleton-shimmer mb-3" />
      <div className="h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded skeleton-shimmer mb-2" />
      <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded skeleton-shimmer" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse">
      <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded skeleton-shimmer mb-4" />
      <div className="h-[320px] w-full bg-gray-100 dark:bg-gray-700 rounded skeleton-shimmer" />
    </div>
  );
}

export function Stats() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [now] = useState(() => Date.now());
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [digest, setDigest] = useState<DigestResult | null>(null);
  const [digestFrequency, setDigestFrequency] = useState("off");
  const [digestPending, setDigestPending] = useState(false);
  const [basketThreshold, setBasketThreshold] = useState<number | null>(null);
  const [basketSheetOpen, setBasketSheetOpen] = useState(false);
  const [basketDraft, setBasketDraft] = useState("");
  const [days, setDays] = useState<MoversWindow>(30);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { pathname } = useLocation();
  const { toast, showToast } = useToast();
  const summaryRef = useRef<HTMLDivElement>(null);

  const handleCopyText = useCallback(async () => {
    const message = buildWatchlistShareText({ watchlist: products ?? [], displayCurrency, days });
    if (await copyTextWithFallback(message)) showToast("Copied to clipboard");
    else showToast("Couldn't copy share text");
  }, [products, displayCurrency, days, showToast]);

  const handleSaveImage = useCallback(async () => {
    if (summaryRef.current) {
      try {
        await saveNodeAsPng(summaryRef.current, "stats-watchlist.png");
        showToast("Stats image saved");
        return;
      } catch {
        showToast("Couldn't save stats image");
      }
    }
  }, [showToast]);

  const loadStats = useCallback(async () => {
    setLoadError(null);
    try {
      const [list, settings, snapshot, alerts] = await Promise.all([
        storage.getWatchlist(),
        storage.getSettings(),
        storage.getPriceDigestSnapshot(),
        storage.getAlerts(),
      ]);
      setProducts(list);
      if (settings?.displayCurrency) setDisplayCurrency(settings.displayCurrency);
      const frequency = settings?.digestFrequency ?? "off";
      setDigestFrequency(frequency);
      setBasketThreshold(settings?.basketAlertThreshold ?? null);
      if (frequency === "off") {
        setDigest(null);
        setDigestPending(false);
        return;
      }
      // Read-only: the digest sender (App.tsx `maybeSendDigest`) owns the
      // snapshot lifecycle and advances it only when a digest is delivered.
      // Saving here advanced the diff base on every Stats visit, so the card
      // showed changes since the last visit rather than since the last digest.
      // Mobile returns null when there is no snapshot; computing against null
      // treated every product as new.
      setDigest(snapshot ? computeDigest(snapshot, list, settings, alerts) : null);
      // Enabled but no snapshot yet: the first digest hasn't been delivered, so
      // there is nothing to diff against. Mobile shows a "Digest scheduled"
      // placeholder (only when the watchlist is non-empty); without this the
      // whole card vanished.
      setDigestPending(!snapshot && list.length > 0);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load statistics");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadStats();
    });
  }, [loadStats, pathname]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadStats();
    } finally {
      setRefreshing(false);
    }
  }, [loadStats]);

  const handleSaveBasketAlert = useCallback(async (threshold: number | null) => {
    const previous = basketThreshold;
    setBasketThreshold(threshold);
    // Serialized read-modify-write: a whole-object write with a stale snapshot
    // would clobber a settings change made elsewhere in the meantime (mobile
    // uses the same serialized update path).
    try {
      await storage.updateSettings({ basketAlertThreshold: threshold });
    } catch {
      // Revert the optimistic update so the UI doesn't show a threshold that
      // was never persisted.
      setBasketThreshold(previous);
      showToast("Couldn't save your basket alert. Please try again.");
    }
  }, [basketThreshold, showToast]);

  const loading = products === null && loadError === null;

  const basket = useMemo(
    () => (products ? computeBasketValue(activeProducts(products), displayCurrency) : null),
    [products, displayCurrency],
  );
  const stockHealth = useMemo(
    () => (products ? computeStockHealth(products) : null),
    [products],
  );
  const movers = useMemo(
    () => (products ? computeMovers(products, displayCurrency, days) : null),
    [products, displayCurrency, days],
  );
  const freshness = useMemo(
    () => (products ? computeDataFreshness(products) : null),
    [products],
  );
  const insights = useMemo(
    () => (products ? computeProductInsights(products, displayCurrency) : null),
    [products, displayCurrency],
  );
  const topDeals = useMemo(
    () => rankDeals(products ?? [], displayCurrency),
    [products, displayCurrency],
  );
  const dropCalendar = useMemo(
    () => computeDropCalendar(products ?? [], displayCurrency, 30),
    [products, displayCurrency],
  );
  // Leading blanks so the columns align to weekdays, like mobile's grid.
  const dropCalendarCells = useMemo(() => buildGridCells(30, now), [now]);

  const chartData = useMemo(() => {
    if (!products || products.length === 0) return { data: [], distributors: [], distributorColors: [] };
    const cutoffStr =
      days === null
        ? ""
        : (() => {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            return cutoff.toISOString().slice(0, 10);
          })();
    // The caption says "Top 3 ... by value", so rank by best price (descending)
    // rather than taking the first three in watchlist order.
    const topByValue = [...products]
      .sort((a, b) => {
        const pa = getBestPrice(a.listings ?? [], displayCurrency)?.price ?? -1;
        const pb = getBestPrice(b.listings ?? [], displayCurrency)?.price ?? -1;
        return pb - pa;
      })
      .slice(0, 3);
    const dateMap = new Map<string, Record<string, number | string>>();
    topByValue.forEach((p) => {
      (p.listings ?? []).forEach((listing) => {
        const dist = DISTRIBUTORS.find((d) => d.id === listing.distributorId);
        const name = dist?.name ?? listing.distributorId;
        (listing.priceHistory ?? []).forEach((pt) => {
          if (pt.date < cutoffStr) return;
          // Skip unconvertible points rather than plotting the raw price, which
          // mixed currencies on a chart labelled in the display currency.
          const converted = convertPrice(pt.price, pt.currency, displayCurrency);
          if (converted === null || !Number.isFinite(converted)) return;
          if (!dateMap.has(pt.date)) dateMap.set(pt.date, { date: pt.date });
          const row = dateMap.get(pt.date)!;
          row[name] = converted;
        });
      });
    });
    const dates = Array.from(dateMap.keys()).sort();
    const data = dates.map((d) => dateMap.get(d)!);
    // Colour by distributor id (the shared hash), not by index: the same
    // distributor must keep the same colour here and on Compare. Index colours
    // plus a duplicated local palette made a distributor blue here and green
    // there.
    const distributorIds: string[] = [];
    for (const p of topByValue) {
      for (const l of p.listings ?? []) {
        if (!distributorIds.includes(l.distributorId)) distributorIds.push(l.distributorId);
      }
    }
    const distributors = distributorIds.map(
      (id) => DISTRIBUTORS.find((d) => d.id === id)?.name ?? id,
    );
    const distributorColors = distributorIds.map((id) => distributorColor(id));
    return { data, distributors, distributorColors };
  }, [products, displayCurrency, days]);

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
        <ChartSkeleton />
        <div className="grid grid-cols-2 gap-4">
          <StatSkeleton />
          <StatSkeleton />
        </div>
      </div>
    );
  }

  if (loadError && !products) {
    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <span className="flex-1">Couldn&apos;t load statistics: {loadError}</span>
          <button
            onClick={() => void loadStats()}
            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
            aria-label="Retry loading statistics"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="p-6 max-w-6xl mx-auto w-full">
        <EmptyState
          icon={<BarChart3 className="w-12 h-12" />}
          title="No statistics yet"
          description="Add products to your watchlist to see price trends and stock health."
        />
        <div className="flex justify-center mt-4">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
          >
            <Package className="w-4 h-4" /> Browse Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 animate-fadeIn">
          {toast}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleRefresh()}
            disabled={loading || refreshing}
            aria-label="Refresh stats"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
          <button
            onClick={handleCopyText}
            disabled={!products || products.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium disabled:opacity-50"
            aria-label="Copy stats as text"
          >
            <Share2 className="w-4 h-4" />
            Copy text
          </button>
          <button
            onClick={handleSaveImage}
            disabled={!products || products.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium disabled:opacity-50"
            aria-label="Save stats as image"
          >
            <Share2 className="w-4 h-4" />
            Save image
          </button>
        </div>
      </div>
      {loadError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <span className="flex-1">Couldn&apos;t load statistics: {loadError}</span>
          <button
            onClick={() => void loadStats()}
            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
            aria-label="Retry loading statistics"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex items-center gap-1" role="group" aria-label="Movers window">
        {(
          [
            { label: "7D", value: 7 },
            { label: "30D", value: 30 },
            { label: "All", value: null },
          ] as { label: string; value: MoversWindow }[]
        ).map((opt) => (
          <button
            key={opt.label}
            onClick={() => setDays(opt.value)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              days === opt.value
                ? "bg-brand-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            aria-label={`Select movers window: ${opt.label}`}
            aria-pressed={days === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div ref={summaryRef}>
        <StatsSummaryCards
          basket={basket}
          basketThreshold={basketThreshold}
          displayCurrency={displayCurrency}
          stockHealth={stockHealth}
          movers={movers}
          onEditBasketAlert={() => {
            setBasketDraft(basketThreshold != null ? String(basketThreshold) : "");
            setBasketSheetOpen(true);
          }}
        />
      </div>

      {products.length === 0 ? null : (
        <DigestCard
          digest={digest}
          digestFrequency={digestFrequency}
          digestPending={digestPending}
          displayCurrency={displayCurrency}
          topDeals={topDeals}
        />
      )}

      {insights && <ProductInsightsCard insights={insights} />}

      <DropCalendarCard
        dropCalendar={dropCalendar}
        dropCalendarCells={dropCalendarCells}
        selectedKey={selectedKey}
        onSelectKey={setSelectedKey}
        displayCurrency={displayCurrency}
      />

      <PriceHistoryCard
        productsCount={products.length}
        chartData={chartData}
        displayCurrency={displayCurrency}
      />

      <StatsHealthCards freshness={freshness} stockHealth={stockHealth} />

      <BasketAlertDialog
        open={basketSheetOpen}
        displayCurrency={displayCurrency}
        draft={basketDraft}
        threshold={basketThreshold}
        onDraftChange={setBasketDraft}
        onClose={() => setBasketSheetOpen(false)}
        onSave={handleSaveBasketAlert}
      />
    </div>
  );
}
