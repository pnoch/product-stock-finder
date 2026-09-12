import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Share2, RefreshCw, Package, BarChart3 } from "lucide-react";
import { copyTextWithFallback, saveNodeAsPng } from "../lib/share";
import { storage } from "../storage";
import { useToast } from "../hooks/use-toast";
import { EmptyState } from "../components/EmptyState";
import { MultiLineChart } from "../components/MultiLineChart";
import { formatPrice, convertPrice, CURRENCY_SYMBOLS } from "@shared/currency";
import { DISTRIBUTORS } from "@shared/distributors";
import type { Product } from "../../../lib/types";
import {
  computeBasketValue,
  computeDataFreshness,
  computeMovers,
  computeStockHealth,
  type MoversWindow,
} from "../../../lib/watchlist-stats";
import { computeDigest, buildDigestSnapshot, type DigestResult, type DigestSnapshot } from "../../../lib/price-digest";
import { computeDropCalendar, dateKey } from "../../../lib/drop-calendar";
import { computeProductInsights } from "../../../lib/product-insights";
import { rankDeals, dealBandLabel } from "../../../lib/deal-score";
import { buildWatchlistShareText } from "../../../lib/watchlist-share";
import { LOG_ERROR } from "@shared/log";

const CHART_COLORS = ["#0F52BA", "#00C896", "#F59E0B", "#EF4444", "#8B5CF6"];

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
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [digest, setDigest] = useState<DigestResult | null>(null);
  const [digestFrequency, setDigestFrequency] = useState("off");
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
  }, [products, displayCurrency, days]);

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
  }, []);

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
      const currency = settings?.displayCurrency ?? "USD";
      const frequency = settings?.digestFrequency ?? "off";
      setDigestFrequency(frequency);
      setBasketThreshold(settings?.basketAlertThreshold ?? null);
      if (frequency === "off") {
        setDigest(null);
        const offSnapshot: DigestSnapshot = buildDigestSnapshot(list, currency);
        try {
          await storage.savePriceDigestSnapshot(offSnapshot);
        } catch (e) {
          LOG_ERROR("[Stats] digest snapshot save failed", e);
        }
        return;
      }
      setDigest(computeDigest(snapshot, list, settings, alerts));
      const nextSnapshot: DigestSnapshot = buildDigestSnapshot(list, currency);
      try {
        await storage.savePriceDigestSnapshot(nextSnapshot);
      } catch (e) {
        LOG_ERROR("[Stats] digest snapshot save failed", e);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load statistics");
    }
  }, []);

  useEffect(() => {
    void loadStats();
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
    setBasketThreshold(threshold);
    const current = await storage.getSettings();
    if (!current) return;
    await storage.saveSettings({ ...current, basketAlertThreshold: threshold });
  }, []);

  const loading = products === null && loadError === null;

  const basket = useMemo(
    () => (products ? computeBasketValue(products, displayCurrency) : null),
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
  const last30DayKeys = useMemo(() => {
    const keys: string[] = [];
    const now = Date.now();
    for (let i = 29; i >= 0; i--) {
      keys.push(dateKey(now - i * 24 * 60 * 60 * 1000));
    }
    return keys;
  }, []);

  const chartData = useMemo(() => {
    if (!products || products.length === 0) return { data: [], distributors: [] };
    const cutoffStr =
      days === null
        ? ""
        : (() => {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            return cutoff.toISOString().slice(0, 10);
          })();
    const dateMap = new Map<string, Record<string, number | string>>();
    products.slice(0, 3).forEach((p) => {
      p.listings.forEach((listing) => {
        const dist = DISTRIBUTORS.find((d) => d.id === listing.distributorId);
        const name = dist?.name ?? listing.distributorId;
        listing.priceHistory.forEach((pt) => {
          if (pt.date < cutoffStr) return;
          if (!dateMap.has(pt.date)) dateMap.set(pt.date, { date: pt.date });
          const row = dateMap.get(pt.date)!;
          row[name] = convertPrice(pt.price, pt.currency, displayCurrency) ?? pt.price;
        });
      });
    });
    const dates = Array.from(dateMap.keys()).sort();
    const data = dates.map((d) => dateMap.get(d)!);
    const distributors = Array.from(
      new Set(
        products
          .slice(0, 3)
          .flatMap((p) =>
            p.listings.map((l) => DISTRIBUTORS.find((d) => d.id === l.distributorId)?.name ?? l.distributorId),
          ),
      ),
    );
    return { data, distributors };
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
          <span className="flex-1">Couldn't load statistics: {loadError}</span>
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
            <Package className="w-4 h-4" /> Add Products
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
          <span className="flex-1">Couldn't load statistics: {loadError}</span>
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

      <div ref={summaryRef} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">Basket Value</p>
            <button
              onClick={() => {
                setBasketDraft(basketThreshold != null ? String(basketThreshold) : "");
                setBasketSheetOpen(true);
              }}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              aria-label={basketThreshold != null ? "Edit basket alert" : "Set alert"}
            >
              {basketThreshold != null ? "Edit alert" : "Set alert"}
            </button>
          </div>
          <p className="text-2xl font-bold mt-1">
            {basket ? formatPrice(basket.total, displayCurrency) : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-1">{basket?.productCount ?? 0} products</p>
          {basketThreshold != null && (
            <p className="text-xs text-gray-400 mt-1">
              🔔 Alert below {formatPrice(basketThreshold, displayCurrency)}
            </p>
          )}
          {basketThreshold != null && basket && basket.total <= basketThreshold && (
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1">
              Basket below alert threshold
            </p>
          )}
        </div>
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
          <p className="text-sm text-gray-500 dark:text-gray-400">In Stock</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {stockHealth ? `${stockHealth.inStockPct}%` : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-1">{stockHealth?.totalListings ?? 0} listings</p>
        </div>
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
          <p className="text-sm text-gray-500 dark:text-gray-400">Top Drops</p>
          {movers && movers.drops.length > 0 ? (
            <div className="mt-2 space-y-2">
              {movers.drops.map((m) => (
                <div key={`${m.productId}-${m.distributorId}`} className="flex items-center gap-2">
                  <span>{m.countryFlag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.productName}</p>
                    <p className="text-xs text-gray-400 truncate">{m.distributorName} · {formatPrice(m.oldPrice, m.currency)} → {formatPrice(m.newPrice, m.currency)}</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600">{m.changePct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mt-2">No movers yet</p>
          )}
        </div>
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
          <p className="text-sm text-gray-500 dark:text-gray-400">Top Gainers</p>
          {movers && movers.gainers.length > 0 ? (
            <div className="mt-2 space-y-2">
              {movers.gainers.map((m) => (
                <div key={`${m.productId}-${m.distributorId}`} className="flex items-center gap-2">
                  <span>{m.countryFlag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.productName}</p>
                    <p className="text-xs text-gray-400 truncate">{m.distributorName} · {formatPrice(m.oldPrice, m.currency)} → {formatPrice(m.newPrice, m.currency)}</p>
                  </div>
                  <span className="text-xs font-bold text-red-600">{m.changePct > 0 ? "+" : ""}{m.changePct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mt-2">No movers yet</p>
          )}
        </div>
      </div>

      {digestFrequency === "off" ? (
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
          <p className="text-sm text-gray-500 dark:text-gray-400">Digest off</p>
          <p className="text-sm text-gray-400 mt-2">Enable daily or weekly price digests to see changes here.</p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
            aria-label="Go to Settings"
          >
            Go to Settings
          </Link>
        </div>
      ) : (
        digest && (
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
          <p className="text-sm text-gray-500 dark:text-gray-400">Digest</p>
          {digest.valueDelta && (
            <p className="text-sm mt-1">
              <span className="text-gray-500 dark:text-gray-400">
                {formatPrice(digest.valueDelta.from, displayCurrency)} →{" "}
                {formatPrice(digest.valueDelta.to, displayCurrency)}
              </span>{" "}
              <span
                className={
                  digest.valueDelta.percent >= 0
                    ? "font-bold text-red-600"
                    : "font-bold text-emerald-600"
                }
              >
                {digest.valueDelta.percent >= 0 ? "+" : ""}
                {digest.valueDelta.percent.toFixed(1)}%
              </span>
            </p>
          )}
          {digest.priceChanges.length === 0 &&
          digest.stockChanges.length === 0 &&
          digest.alertTargetsHit.length === 0 &&
          digest.newProducts.length === 0 &&
          digest.removedProducts.length === 0 ? (
            <p className="text-sm text-gray-400 mt-2">No changes in this period.</p>
          ) : (
            <div className="mt-2 space-y-2 text-sm">
              {digest.priceChanges.length > 0 && (
                <div>
                  {digest.priceChanges.slice(0, 3).map((c) => (
                    <p key={c.productId} className="text-gray-600 dark:text-gray-400">
                      <span className="text-gray-900 dark:text-gray-100">{c.name}</span>{" "}
                      {formatPrice(c.from, displayCurrency)} →{" "}
                      {formatPrice(c.to, displayCurrency)}{" "}
                      <span
                        className={
                          c.percent > 0
                            ? "font-semibold text-red-600"
                            : "font-semibold text-emerald-600"
                        }
                      >
                        {c.percent > 0 ? "+" : ""}
                        {c.percent.toFixed(0)}%
                      </span>
                    </p>
                  ))}
                  {digest.priceChanges.length > 3 && (
                    <p className="text-xs text-gray-400">+{digest.priceChanges.length - 3} more</p>
                  )}
                </div>
              )}
              {topDeals.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Best time to buy
                  </p>
                  {topDeals.map((d) => (
                    <Link
                      key={d.productId}
                      to={`/product/${d.productId}`}
                      className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                      aria-label={`View ${d.name} details`}
                    >
                      <span className="text-gray-900 dark:text-gray-100 truncate flex-1">
                        {d.name}
                      </span>{" "}
                      <span className="text-gray-500 dark:text-gray-400">{d.score}</span>{" "}
                      <span
                        className={
                          d.band === "hot"
                            ? "font-semibold text-emerald-600"
                            : d.band === "fair"
                              ? "font-semibold text-amber-600"
                              : "font-semibold text-gray-400"
                        }
                      >
                        {dealBandLabel(d.band)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {digest.stockChanges.length > 0 && (
                <div>
                  {digest.stockChanges.slice(0, 3).map((s) => (
                    <p key={s.productId} className="text-gray-600 dark:text-gray-400">
                      <span className="text-gray-900 dark:text-gray-100">{s.name}</span>: {s.from} → {s.to}
                    </p>
                  ))}
                  {digest.stockChanges.length > 3 && (
                    <p className="text-xs text-gray-400">+{digest.stockChanges.length - 3} more</p>
                  )}
                </div>
              )}
              {digest.alertTargetsHit.length > 0 && (
                <div>
                  {digest.alertTargetsHit.slice(0, 3).map((t) => (
                    <p key={t.productId} className="text-gray-600 dark:text-gray-400">
                      🎯 <span className="text-gray-900 dark:text-gray-100">{t.name}</span> at{" "}
                      {formatPrice(t.price, t.currency)}
                    </p>
                  ))}
                  {digest.alertTargetsHit.length > 3 && (
                    <p className="text-xs text-gray-400">+{digest.alertTargetsHit.length - 3} more</p>
                  )}
                </div>
              )}
              {digest.newProducts.length > 0 && (
                <div>
                  {digest.newProducts.slice(0, 3).map((p) => (
                    <p key={p.productId} className="text-gray-600 dark:text-gray-400">
                      ➕ <span className="text-gray-900 dark:text-gray-100">{p.name}</span>
                    </p>
                  ))}
                  {digest.newProducts.length > 3 && (
                    <p className="text-xs text-gray-400">+{digest.newProducts.length - 3} more</p>
                  )}
                </div>
              )}
              {digest.removedProducts.length > 0 && (
                <div>
                  {digest.removedProducts.slice(0, 3).map((p) => (
                    <p key={p.productId} className="text-gray-600 dark:text-gray-400">
                      ➖ <span className="text-gray-900 dark:text-gray-100">{p.name}</span>
                    </p>
                  ))}
                  {digest.removedProducts.length > 3 && (
                    <p className="text-xs text-gray-400">+{digest.removedProducts.length - 3} more</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        )
      )}

      {insights && (
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
          <p className="text-sm text-gray-500 dark:text-gray-400">Product Insights</p>
          <div className="flex gap-2 mt-1">
            <div className="flex-1">
              <p className="text-lg font-bold text-emerald-600">{insights.allTimeLows}</p>
              <p className="text-xs text-gray-400">At all-time low</p>
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{insights.droppingCount}</p>
              <p className="text-xs text-gray-400">Dropping now</p>
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {insights.volatility.low}·{insights.volatility.medium}·{insights.volatility.high}
              </p>
              <p className="text-xs text-gray-400">Volatility</p>
              <p className="text-[11px] text-gray-400">Low · Medium · High</p>
            </div>
          </div>
          {insights.products.filter((p) => p.atAllTimeLow).slice(0, 3).length > 0 && (
            <div className="mt-2 space-y-1">
              {insights.products
                .filter((p) => p.atAllTimeLow)
                .slice(0, 3)
                .map((p) => (
                  <p key={p.productId} className="text-xs text-emerald-600 truncate">
                    🏅 {p.name} is at its all-time low
                  </p>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
        <p className="text-sm text-gray-500 dark:text-gray-400">Drop Calendar</p>
        <p className="text-lg font-bold mt-1">
          {dropCalendar.totalDrops} {dropCalendar.totalDrops === 1 ? "drop" : "drops"} in 30 days
        </p>
        <div className="grid grid-cols-7 gap-1 mt-3" role="grid" aria-label="Price drop calendar, last 30 days">
          {last30DayKeys.map((key) => {
            const day = dropCalendar.byDay.get(key);
            const dropCount = day?.dropCount ?? 0;
            const hasDrops = dropCount > 0;
            const label = hasDrops
              ? `${key}: ${dropCount} ${dropCount === 1 ? "drop" : "drops"}, biggest ${day?.biggestPct}%`
              : key;
            if (hasDrops) {
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  title={label}
                  aria-label={label}
                  aria-pressed={selectedKey === key}
                  onClick={() => setSelectedKey((k) => (k === key ? null : key))}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${
                    "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {dropCount}
                </button>
              );
            }
            return (
              <div
                key={key}
                title={label}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-400"
              >
                {Number(key.slice(8, 10))}
              </div>
            );
          })}
        </div>
        {selectedKey && dropCalendar.byDay.get(selectedKey) && (
          <div className="mt-2">
            <p>Drops on {selectedKey}</p>
            {dropCalendar.byDay.get(selectedKey)!.drops.map((drop) => (
              <Link key={`${drop.productId}-${drop.from}-${drop.to}`} to={`/product/${drop.productId}`} className="flex items-center gap-2 py-1 text-sm hover:underline">
                <span className="truncate">{drop.name}</span>
                <span>{formatPrice(drop.from, displayCurrency)} → {formatPrice(drop.to, displayCurrency)}</span>
                <span>{drop.percent.toFixed(0)}%</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Price History</h2>
        {products.length > 3 && (
          <p className="text-xs text-gray-400 mt-1 mb-2">Top 3 of {products.length} by value</p>
        )}
        {chartData.data.length > 0 ? (
          <MultiLineChart
            data={chartData.data}
            distributors={chartData.distributors}
            colors={CHART_COLORS}
            currencySymbol={CURRENCY_SYMBOLS[displayCurrency] ?? "$"}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
            <BarChart3 className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No price history yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-sm">
              Price points will appear here once distributors are tracked over time.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Data Freshness</p>
          {freshness ? (
            <div className="space-y-1 text-sm">
              <p className="text-gray-600 dark:text-gray-400">
                Stale: <span className="font-medium text-gray-900 dark:text-gray-100">{freshness.staleCount}</span> · Never checked:{" "}
                <span className="font-medium text-gray-900 dark:text-gray-100">{freshness.neverCheckedCount}</span>
              </p>
              <p className="text-xs text-gray-400">
                Oldest update{" "}
                {freshness.oldestCheck
                  ? new Date(freshness.oldestCheck).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No data</p>
          )}
        </div>
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Stock Health</p>
          {stockHealth ? (
            <div className="space-y-1 text-sm">
              <p className="text-gray-600 dark:text-gray-400">
                {stockHealth.inStockPct}% in stock · {stockHealth.fullyOutOfStock} fully out of stock
              </p>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${stockHealth.inStockPct}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No data</p>
          )}
        </div>
      </div>

      {basketSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setBasketSheetOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg mb-1">Basket Value Alert</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Notify me when the total watchlist value drops below this amount
              ({displayCurrency}). Fires once, then turns off.
            </p>
            <label className="block text-xs font-semibold mb-1">
              Threshold ({displayCurrency})
            </label>
            <input
              type="number"
              value={basketDraft}
              onChange={(e) => setBasketDraft(e.target.value)}
              placeholder="e.g. 500"
              min="0"
              step="0.01"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Basket alert threshold"
            />
            <div className="flex gap-2">
              {basketThreshold != null && (
                <button
                  onClick={() => {
                    void handleSaveBasketAlert(null);
                    setBasketSheetOpen(false);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700"
                  aria-label="Disable basket alert"
                >
                  Disable
                </button>
              )}
              <button
                onClick={() => {
                  const numeric = parseFloat(basketDraft);
                  if (isNaN(numeric) || numeric <= 0) return;
                  void handleSaveBasketAlert(numeric);
                  setBasketSheetOpen(false);
                }}
                disabled={!(parseFloat(basketDraft) > 0)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
                aria-label="Enable basket alert"
              >
                Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
