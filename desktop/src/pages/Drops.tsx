import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Share2, TrendingDown } from "lucide-react";
import { formatPrice } from "@shared/currency";
import {
  buildDropShareText,
  computeLocalDrops,
  formatDropPct,
  type DropSortBy,
  type DropWindow,
  type PriceDrop,
} from "../../../lib/price-leaderboard";
import type { Product } from "../../../lib/types";
import { storage } from "../storage";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../hooks/use-auth";
import { createTRPCClient } from "../lib/trpc";
import { copyTextWithFallback } from "../lib/share";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ProductImage } from "../components/ProductImage";

const WINDOWS: DropWindow[] = ["24h", "7d", "30d"];
const SORTS: { key: DropSortBy; label: string }[] = [
  { key: "pct", label: "%" },
  { key: "abs", label: "$" },
];

type DropsTab = "your" | "global";

export function Drops() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [window, setWindow] = useState<DropWindow>("7d");
  const [sortBy, setSortBy] = useState<DropSortBy>("pct");
  const [tab, setTab] = useState<DropsTab>("your");
  const [globalDrops, setGlobalDrops] = useState<PriceDrop[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const failedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setLoadError(null);
    Promise.all([storage.getWatchlist(), storage.getSettings()])
      .then(([watchlist, settings]) => {
        if (!active) return;
        setProducts(watchlist);
        if (settings?.displayCurrency) setDisplayCurrency(settings.displayCurrency);
      })
      .catch((e) => {
        if (active) setLoadError(e instanceof Error ? e.message : "Couldn't load drops");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated && tab === "global") setTab("your");
  }, [isAuthenticated, tab]);

  useEffect(() => {
    if (tab !== "global" || !isAuthenticated) return;
    const key = `${window}:${sortBy}`;
    let active = true;
    setGlobalLoading(true);
    const client = createTRPCClient();
    client.prices.topDrops
      .query({ window, limit: 20, sortBy })
      .then((rows) => {
        if (!active) return;
        setGlobalDrops(rows as PriceDrop[]);
      })
      .catch(() => {
        if (!active) return;
        setTab("your");
        if (!failedKeysRef.current.has(key)) {
          failedKeysRef.current.add(key);
          showToast("Couldn't load global drops — showing yours");
        }
      })
      .finally(() => {
        if (active) setGlobalLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, isAuthenticated, window, sortBy, showToast]);

  const localDrops = useMemo(
    () => computeLocalDrops(products, window, displayCurrency, sortBy, 20),
    [products, window, displayCurrency, sortBy],
  );

  const watchlistIds = useMemo(() => new Set(products.map((p) => p.id)), [products]);

  const visibleDrops = tab === "your" ? localDrops : globalDrops;
  const loading = !loaded || (tab === "global" && globalLoading);

  const handleRowClick = useCallback(
    (drop: PriceDrop) => {
      if (watchlistIds.has(drop.productId)) {
        navigate(`/product/${drop.productId}`);
      } else {
        navigate("/search");
      }
    },
    [navigate, watchlistIds],
  );

  const handleShare = useCallback(async () => {
    if (visibleDrops.length === 0) {
      showToast("Nothing to share yet");
      return;
    }
    const text = buildDropShareText(visibleDrops, window, sortBy);
    if (await copyTextWithFallback(text)) showToast("Copied to clipboard");
    else showToast("Couldn't copy share text");
  }, [visibleDrops, window, sortBy, showToast]);

  return (
    <div className="p-6 space-y-4">
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-[60] animate-fadeIn">
          {toast}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Price Drops</h1>
        <button
          type="button"
          onClick={() => void handleShare()}
          aria-label="Share price drops"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>

      <div className="flex items-center gap-1">
        {WINDOWS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWindow(w)}
            aria-label={`Show drops from last ${w}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer ${
              window === w
                ? "bg-brand-600 text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {w}
          </button>
        ))}
        <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" aria-hidden="true" />
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSortBy(s.key)}
            aria-label={`Sort by ${s.key === "pct" ? "percentage" : "amount"}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer ${
              sortBy === s.key
                ? "bg-brand-600 text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isAuthenticated && (
        <div className="flex gap-1 p-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-fit">
          {(["your", "global"] as DropsTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-label={t === "your" ? "Show your drops" : "Show global drops"}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors duration-150 cursor-pointer ${
                tab === t
                  ? "bg-brand-600 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {t === "your" ? "Your Drops" : "Global Drops"}
            </button>
          ))}
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200">
          Couldn&apos;t load drops: {loadError}
        </div>
      )}

      {loading ? (
        <LoadingSpinner size="large" label="Loading drops..." />
      ) : visibleDrops.length === 0 ? (
        <EmptyState
          icon={<TrendingDown className="w-8 h-8" />}
          title={tab === "your" ? "No drops this period" : "No drops found"}
          description={
            tab === "your"
              ? "No drops this period — add products to your watchlist to track them."
              : "No drops found — try a longer time range."
          }
          action={tab === "your" ? { label: "Browse Products", to: "/search" } : undefined}
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="hidden md:grid grid-cols-[2fr_1.5fr_1.5fr_0.7fr_0.7fr] gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <span>Product</span>
            <span>Distributor</span>
            <span>Was → Now</span>
            <span className="text-right">Drop %</span>
            <span className="text-right">Drop $</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {visibleDrops.map((drop) => (
              <button
                key={`${drop.productId}:${drop.distributorId}`}
                type="button"
                onClick={() => handleRowClick(drop)}
                aria-label={`View ${drop.productName}`}
                className="w-full grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1.5fr_0.7fr_0.7fr] gap-1 md:gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer items-center"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <ProductImage productId={drop.productId} size={36} />
                  <span className="min-w-0">
                    <span className="block font-medium text-sm truncate">{drop.productName}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                      {drop.modelNumber || drop.distributorName}
                    </span>
                  </span>
                  <span className="md:hidden ml-auto text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatDropPct(drop.dropPct)}
                  </span>
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                  {drop.distributorName}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                  {formatPrice(drop.previousPrice, drop.currency)} →{" "}
                  {formatPrice(drop.currentPrice, drop.currency)}
                </span>
                <span className="hidden md:block text-sm font-bold text-emerald-600 dark:text-emerald-400 text-right">
                  {formatDropPct(drop.dropPct)}
                </span>
                <span className="hidden md:block text-sm text-gray-500 dark:text-gray-400 text-right">
                  −{formatPrice(drop.dropAbs, drop.currency)}
                </span>
                <span className="md:hidden text-xs text-gray-500 dark:text-gray-400">
                  {formatPrice(drop.previousPrice, drop.currency)} →{" "}
                  {formatPrice(drop.currentPrice, drop.currency)} · −
                  {formatPrice(drop.dropAbs, drop.currency)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
