import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { TrendingDown } from "lucide-react";
import { formatPrice } from "@shared/currency";
import {
  computeLocalDrops,
  formatDropPct,
  type DropSortBy,
  type DropWindow,
} from "../../../lib/price-leaderboard";
import type { Product } from "../../../lib/types";
import { storage } from "../storage";

const WINDOWS: DropWindow[] = ["24h", "7d", "30d"];
const SORTS: { key: DropSortBy; label: string }[] = [
  { key: "pct", label: "%" },
  { key: "abs", label: "$" },
];

export function DropLeaderboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [window, setWindow] = useState<DropWindow>("7d");
  const [sortBy, setSortBy] = useState<DropSortBy>("pct");

  useEffect(() => {
    let active = true;
    Promise.all([storage.getWatchlist(), storage.getSettings()])
      .then(([watchlist, settings]) => {
        if (!active) return;
        setProducts(watchlist);
        if (settings?.displayCurrency) setDisplayCurrency(settings.displayCurrency);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const drops = useMemo(
    () => computeLocalDrops(products, window, displayCurrency, sortBy, 5),
    [products, window, displayCurrency, sortBy],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-emerald-500" />
          Biggest Drops
        </h2>
        <div className="flex items-center gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindow(w)}
              aria-label={`Show drops from last ${w}`}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer ${
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
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                sortBy === s.key
                  ? "bg-brand-600 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {drops.length === 0 ? (
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No drops this period</p>
        </div>
      ) : (
        <div className="space-y-2">
          {drops.map((drop, idx) => (
            <Link
              key={`${drop.productId}:${drop.distributorId}`}
              to={`/product/${drop.productId}`}
              className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-sm transition-all duration-200 animate-fadeIn"
              style={{ animationDelay: `${idx * 80}ms` }}
              aria-label={`View ${drop.productName} details`}
            >
              <div className="flex-1 min-w-0 mr-4">
                <p className="font-medium truncate">{drop.productName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {drop.distributorName}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {formatDropPct(drop.dropPct)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  −{formatPrice(drop.dropAbs, drop.currency)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="flex justify-end mt-2">
        <Link
          to="/drops"
          className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
          aria-label="See all price drops"
        >
          See all →
        </Link>
      </div>
    </div>
  );
}
