import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router";
import { storage } from "../storage";
import { useToast } from "../hooks/use-toast";
import { formatPrice, CURRENCY_SYMBOLS } from "@shared/currency";
import { convertPrice } from "@/lib/currency";
import { DISTRIBUTORS, getDistributorById } from "@shared/distributors";
import type { Product, PriceAlert } from "../../../lib/types";
import { buildShareText } from "../../../lib/price-share";
import { copyTextWithFallback, saveNodeAsPng } from "../lib/share";
import { StockBadge } from "../components/StockBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { TimeRangeChips } from "../components/TimeRangeChips";
import { filterByRange, cheapestByRegion, type TimeRange } from "@shared/compare-utils";
import {
  GitCompareArrows,
  Share2,
  TrendingDown,
  TrendingUp,
  Minus,
  Check,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";

const CHART_COLORS = [
  "#0F52BA",
  "#00C896",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
];

function toTimeRange(k: string): TimeRange {
  switch (k) {
    case "1w":
      return "1W";
    case "1m":
      return "1M";
    case "3m":
      return "3M";
    default:
      return "All";
  }
}

export function clampChartWidth(measured: number): number {
  return Math.min(960, Math.max(320, Math.floor(measured)));
}

function SeriesChart({
  series,
  displayCurrency,
}: {
  series: { label: string; color: string; data: { price: number; currency: string; date: string }[] }[];
  displayCurrency: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number" && Number.isFinite(w)) setMeasured(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const width = measured === null ? 640 : clampChartWidth(measured);
  const height = 280;
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const usableW = width - padL - padR;
  const usableH = height - padT - padB;

  const allPrices: number[] = [];
  for (const s of series) {
    for (const p of s.data) {
      const c = convertPrice(p.price, p.currency, displayCurrency);
      if (c !== null && Number.isFinite(c)) allPrices.push(c);
    }
  }
  // Hooks must run unconditionally: an early return before useState/useMemo
  // makes React throw "Rendered more hooks than during the previous render"
  // when the chart transitions from empty to non-empty.
  const [hover, setHover] = useState<{ x: number; y: number; idx: number } | null>(null);
  const sortedSeries = series.map((s) => ({
    ...s,
    sorted: [...s.data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
  }));
  const chartA11yLabel = useMemo(() => {
    let up = 0;
    let down = 0;
    for (const s of sortedSeries) {
      if (s.sorted.length < 2) continue;
      const firstPt = s.sorted[0];
      const lastPt = s.sorted[s.sorted.length - 1];
      const firstConv = convertPrice(firstPt.price, firstPt.currency, displayCurrency);
      const lastConv = convertPrice(lastPt.price, lastPt.currency, displayCurrency);
      const first = firstConv ?? firstPt.price;
      const last = lastConv ?? lastPt.price;
      if (last > first) up += 1;
      else if (last < first) down += 1;
    }
    const direction = up > down ? "up" : down > up ? "down" : "mixed";
    const n = sortedSeries.length;
    return `Price history, ${n} distributor${n === 1 ? "" : "s"}, trending ${direction}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, displayCurrency]);

  if (allPrices.length === 0) {
    return <div className="text-center text-sm text-gray-400 py-8">No data</div>;
  }
  const globalMin = Math.min(...allPrices);
  const globalMax = Math.max(...allPrices);
  const range = globalMax - globalMin || 1;
  const allDates: number[] = [];
  for (const s of series) for (const p of s.data) allDates.push(new Date(p.date).getTime());
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const dateRange = maxDate - minDate || 1;
  const symbol = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency;

  return (
    <div ref={wrapRef} className="w-full">
      <div className="relative mx-auto" style={{ width, height }}>
        <svg
          width={width}
          height={height}
          className="block"
          role="img"
          aria-label={chartA11yLabel}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
            const mx = e.clientX - rect.left;
            // find nearest date index from first series
            const firstSorted = sortedSeries[0]?.sorted;
            if (!firstSorted || firstSorted.length === 0) return;
            let bestIdx = 0;
            let bestDist = Infinity;
            firstSorted.forEach((p, i) => {
              const x = padL + ((new Date(p.date).getTime() - minDate) / dateRange) * usableW;
              const d = Math.abs(x - mx);
              if (d < bestDist) { bestDist = d; bestIdx = i; }
            });
            const px = padL + ((new Date(firstSorted[bestIdx].date).getTime() - minDate) / dateRange) * usableW;
            setHover({ x: px, y: padT, idx: bestIdx });
          }}
          onMouseLeave={() => setHover(null)}
        >
          {[0, 0.5, 1].map((t) => {
            const y = padT + (1 - t) * usableH;
            const val = globalMin + t * range;
            return (
              <g key={t}>
                <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#e5e7eb" strokeDasharray="4,4" strokeWidth={0.5} />
                <text x={padL - 6} y={y + 3} fontSize={9} fill="#6b7280" textAnchor="end">
                  {symbol}
                  {val.toFixed(0)}
                </text>
              </g>
            );
          })}
          {sortedSeries.map((s) => {
            const coords = s.sorted
              .map((p) => {
                const conv = convertPrice(p.price, p.currency, displayCurrency);
                if (conv === null || !Number.isFinite(conv)) return null;
                const x = padL + ((new Date(p.date).getTime() - minDate) / dateRange) * usableW;
                const y = padT + (1 - (conv - globalMin) / range) * usableH;
                return { x, y };
              })
              .filter((c): c is { x: number; y: number } => c !== null);
            if (coords.length < 2) return null;
            const points = coords.map((c) => `${c.x},${c.y}`).join(" ");
            return (
              <g key={s.label}>
                <polyline points={points} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {coords.map((c, i) => (
                  <circle key={i} cx={c.x} cy={c.y} r={hover?.idx === i ? 4 : 2.5} fill={s.color} stroke={hover?.idx === i ? "#fff" : "none"} strokeWidth={hover?.idx === i ? 1.5 : 0} />
                ))}
              </g>
            );
          })}
          {hover && <line x1={hover.x} y1={padT} x2={hover.x} y2={height - padB} stroke="#0F52BA" strokeDasharray="4 4" strokeOpacity={0.35} />}
          {(() => {
            if (sortedSeries[0]?.sorted.length === 0) return null;
            const first = sortedSeries[0]?.sorted ?? [];
            if (first.length === 0) return null;
            const idxs = [0, Math.floor((first.length - 1) / 2), first.length - 1];
            return idxs.map((idx) => {
              const p = first[idx];
              if (!p) return null;
              const x = padL + ((new Date(p.date).getTime() - minDate) / dateRange) * usableW;
              const label = new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
              return (
                <text key={idx} x={x} y={height - 8} fontSize={9} fill="#6b7280" textAnchor="middle">
                  {label}
                </text>
              );
            });
          })()}
        </svg>
        {hover && (
          <div
            className="absolute z-10 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 shadow-lg px-3 py-2 text-xs pointer-events-none"
            style={{ left: Math.min(Math.max(hover.x + 12, 8), width - 160), top: 12 }}
          >
            <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">
              {new Date(sortedSeries[0].sorted[hover.idx]?.date ?? "").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
            {sortedSeries.map((s, i) => {
              const pt = s.sorted[hover.idx];
              if (!pt) return null;
              const conv = convertPrice(pt.price, pt.currency, displayCurrency);
              if (conv === null) return null;
              return (
                <p key={s.label} className="flex items-center gap-2 animate-fadeIn" style={{ animationDelay: `${i * 55}ms` } as React.CSSProperties}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-gray-500 dark:text-gray-400 truncate max-w-[90px]">{s.label}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 ml-auto">{symbol}{conv.toFixed(2)}</span>
                </p>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
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
    void loadCompare();
  }, [loadCompare]);

  useEffect(() => {
    if (!product) return;
    const paramKey = `${product.id}|${distributorParam ?? ""}`;
    if (distributorParam && product.listings.some((l) => l.distributorId === distributorParam)) {
      if (lastAppliedParam.current !== paramKey) {
        lastAppliedParam.current = paramKey;
        selectionInitialized.current = product.id;
        setSelected(new Set([distributorParam]));
      }
      return;
    }
    if (selectionInitialized.current === product.id) return;
    selectionInitialized.current = product.id;
    const withHistory = product.listings
      .filter((l) => l.priceHistory && l.priceHistory.length >= 2)
      .sort((a, b) => {
        const aConv = convertPrice(a.price, a.currency, displayCurrency) ?? a.price;
        const bConv = convertPrice(b.price, b.currency, displayCurrency) ?? b.price;
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

  const timeRangeTyped = useMemo(() => toTimeRange(timeRange), [timeRange]);

  const chartSeries = useMemo(() => {
    if (!product) return [];
    const range = timeRangeTyped;
    const selectedIds = selected;
    const list = product.listings.filter(
      (l) =>
        selectedIds.has(l.distributorId) &&
        l.priceHistory &&
        l.priceHistory.length >= 2,
    );
    return list.map((l) => {
      const distributor = getDistributorById(l.distributorId);
      const filtered = filterByRange(l.priceHistory, range);
      const colorIdx = Array.from(selectedIds).indexOf(l.distributorId);
      return {
        label: distributor?.name ?? l.distributorId,
        color: CHART_COLORS[(colorIdx >= 0 ? colorIdx : 0) % CHART_COLORS.length],
        data: filtered as { price: number; currency: string; date: string }[],
      };
    });
  }, [product, timeRangeTyped, selected]);

  const priceTrends = useMemo(() => {
    if (!product) return new Map<string, { pct: number; dir: "up" | "down" | "flat" }>();
    const map = new Map<string, { pct: number; dir: "up" | "down" | "flat" }>();
    for (const l of product.listings) {
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
    const listings = product.listings.map((l) => {
      const dist = DISTRIBUTORS.find((d) => d.id === l.distributorId);
      return { ...l, distName: dist?.name ?? l.distributorId, dist };
    });
    if (sortBy === "price") {
      return listings.sort(
        (a, b) =>
          (convertPrice(a.price, a.currency, displayCurrency) ?? a.price) -
          (convertPrice(b.price, b.currency, displayCurrency) ?? b.price),
      );
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
    return inStock.reduce((best, curr) => {
      const currConv = convertPrice(curr.price, curr.currency, displayCurrency) ?? curr.price;
      const bestConv = convertPrice(best.price, best.currency, displayCurrency) ?? best.price;
      return currConv < bestConv ? curr : best;
    });
  }, [sortedListings, displayCurrency]);

  const regionBest = useMemo(() => cheapestByRegion(sortedListings, displayCurrency), [sortedListings, displayCurrency]);

  const alertTarget = useMemo(() => {
    const inStock = sortedListings.filter((l) => l.stockStatus === "in_stock");
    if (inStock.length === 0) return null;
    const vals = inStock
      .map((l) => convertPrice(l.price, l.currency, displayCurrency))
      .filter((v): v is number => v !== null && Number.isFinite(v));
    if (vals.length === 0) return null;
    return Math.round(Math.min(...vals) * 0.95 * 100) / 100;
  }, [sortedListings, displayCurrency]);

  const handleCrossAlert = useCallback(async () => {
    if (!id || !product || alertTarget === null) return;
    const alert: PriceAlert = {
      id: `cross-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: id,
      distributorId: undefined,
      targetPrice: alertTarget,
      currency: displayCurrency,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    await storage.addAlert(alert);
    showToast(`Alert set below ${formatPrice(alertTarget, displayCurrency)}`);
  }, [id, product, alertTarget, displayCurrency]);

  const handleShareCompare = useCallback(async () => {
    if (!product) return;
    const message = `${buildShareText({ product, listings: sortedListings, displayCurrency, limit: 5 })}\n\n${window.location.origin}/#/compare/${product.id}`;
    if (await copyTextWithFallback(message)) showToast("Copied to clipboard");
    else showToast("Couldn't copy share text");
  }, [product, sortedListings, displayCurrency]);

  const handleSaveImage = useCallback(async () => {
    if (!chartRef.current || !product) return;
    try {
      await saveNodeAsPng(chartRef.current, `compare-${product.id}.png`);
      showToast("Comparison image saved");
    } catch {
      showToast("Couldn't save comparison image");
    }
  }, [product]);

  const getTrend = (priceHistory: { price: number; date: string }[]) => {
    if (priceHistory.length < 2) return "flat";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {product.brand} · {product.modelNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/watchlist"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            aria-label="Back to watchlist"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <button
            onClick={() => void loadCompare()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Refresh comparison"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={() => void handleShareCompare()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            aria-label="Share comparison"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button
            onClick={() => void handleSaveImage()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            aria-label="Save comparison image"
          >
            Save image
          </button>
          <TimeRangeChips selected={timeRange} onSelect={setTimeRange} />
        </div>
      </div>

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

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Cheapest by Region
        </h3>
        {regionBest.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-3">No in-stock regions</p>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {regionBest.map((item, i) => {
              const dist = getDistributorById(item.listing.distributorId);
              return (
                <div
                  key={item.region}
                  className={`flex items-center justify-between px-3 py-2.5 ${
                    i === 0 ? "bg-emerald-50 dark:bg-emerald-900/20 rounded-lg" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {i === 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300">
                        BEST
                      </span>
                    )}
                    <span className="text-sm font-medium">{item.region}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{dist?.countryFlag}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {dist?.name ?? item.listing.distributorId}
                    </span>
                  </div>
                  <span className={`text-sm font-semibold ${i === 0 ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
                    {formatPrice(item.listing.price, item.listing.currency)}
                    {item.listing.currency !== displayCurrency && (
                      <> ≈ {formatPrice(item.converted, displayCurrency)}</>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {alertTarget !== null && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-semibold">Alert me below {formatPrice(alertTarget, displayCurrency)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">5% below the best in-stock price, any distributor</div>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Select Distributors ({selected.size}/5)
          </h2>
          <span className="text-xs text-gray-400">
            {sortedListings.filter((l) => l.priceHistory && l.priceHistory.length >= 2).length} with history
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {sortedListings.map((listing) => {
            const distributor = getDistributorById(listing.distributorId);
            const isSelected = selected.has(listing.distributorId);
            const hasHistory = listing.priceHistory && listing.priceHistory.length >= 2;
            const colorIdx = Array.from(selected).indexOf(listing.distributorId);
            const chipColor = isSelected ? CHART_COLORS[colorIdx % CHART_COLORS.length] : "#d1d5db";
            const trend = priceTrends.get(listing.distributorId);
            const disabled = !hasHistory && !isSelected;
            const atLimit = !isSelected && selected.size >= 5;
            return (
              <button
                key={listing.distributorId}
                onClick={() => toggleSelect(listing.distributorId)}
                disabled={disabled || atLimit}
                aria-pressed={isSelected}
                aria-label={`${isSelected ? "Deselect" : "Select"} ${distributor?.name ?? listing.distributorId}`}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium border transition-colors ${
                  isSelected
                    ? "text-white border-transparent"
                    : disabled || atLimit
                      ? "bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-60"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
                style={isSelected ? { backgroundColor: chipColor, borderColor: chipColor } : undefined}
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: isSelected ? "#fff" : "transparent",
                    borderColor: isSelected ? "#fff" : chipColor,
                  }}
                >
                  {isSelected && <Check className="w-3 h-3" style={{ color: chipColor }} />}
                </span>
                <span>{distributor?.countryFlag}</span>
                <span>{distributor?.name ?? listing.distributorId}</span>
                <span className={`ml-1 ${isSelected ? "text-white/90" : "text-gray-500 dark:text-gray-400"}`}>
                  {formatPrice(listing.price, listing.currency)}
                </span>
                {trend && trend.dir !== "flat" && (
                  <span className={`text-[10px] font-bold ${isSelected ? "text-white" : trend.dir === "down" ? "text-emerald-600" : "text-red-500"}`}>
                    {trend.dir === "down" ? "▼" : "▲"} {trend.pct.toFixed(1)}%
                  </span>
                )}
                {!hasHistory && <span className="text-[10px] opacity-70">(no history)</span>}
              </button>
            );
          })}
        </div>
        {selected.size >= 5 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Maximum 5 distributors selected.</p>
        )}
      </div>

      {chartSeries.length > 0 ? (
        <div ref={chartRef} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
            Price History ({displayCurrency})
          </h2>
          {chartSeries.length >= 2 ? (
            <SeriesChart series={chartSeries} displayCurrency={displayCurrency} />
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Select at least 2 distributors with price history to compare</p>
              <div className="mt-4">
                <SeriesChart series={chartSeries} displayCurrency={displayCurrency} />
              </div>
            </div>
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

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Distributors
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy("name")}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                sortBy === "name"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              }`}
              aria-label="Sort by name"
            >
              Name
            </button>
            <button
              onClick={() => setSortBy("price")}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                sortBy === "price"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              }`}
              aria-label="Sort by price"
            >
              Price
            </button>
            <button
              onClick={() => setSortBy("trend")}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                sortBy === "trend"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              }`}
              aria-label="Sort by trend"
            >
              Trend
            </button>
          </div>
        </div>
        {sortedListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-gray-300 dark:text-gray-600 mb-3">
              <GitCompareArrows className="w-10 h-10" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">No distributors to compare</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
              Add distributors to this product to see side-by-side prices and trends.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedListings.map((listing, idx) => {
              const trend = getTrend(listing.priceHistory);
              return (
                <div
                  key={listing.distributorId}
                  className={`flex items-center justify-between px-4 py-3 transition-colors ${
                    idx % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50/60 dark:bg-gray-800/40"
                  } hover:bg-gray-50 dark:hover:bg-gray-700/60`}
                >
                  <div className="flex items-center gap-3">
                    {listing.dist && (
                      <span className="text-lg">{listing.dist.countryFlag}</span>
                    )}
                    <div>
                      <p className="font-medium text-sm">{listing.distName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {listing.dist?.country ?? listing.distributorId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StockBadge
                      status={listing.stockStatus}
                      expectedDate={listing.expectedDate}
                    />
                    <div className="text-right min-w-[100px]">
                      <p className="font-semibold text-sm">
                        {formatPrice(listing.price, listing.currency)}
                      </p>
                    </div>
                    <div className="w-8 flex justify-center">
                      {trend === "down" && (
                        <TrendingDown className="w-4 h-4 text-emerald-500" />
                      )}
                      {trend === "up" && (
                        <TrendingUp className="w-4 h-4 text-red-500" />
                      )}
                      {trend === "flat" && (
                        <Minus className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
