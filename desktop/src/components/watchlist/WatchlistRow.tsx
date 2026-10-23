import {
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { formatPrice } from "@shared/currency";
import { useMemo } from "react";
import { getBestPrice } from "../../../../lib/currency";
import { formatLastRefreshed } from "../../../../lib/last-refreshed";
import type { DealScore } from "../../../../lib/deal-score";
import type { Product, TagDefinition } from "../../../../lib/types";
import { getDominantStatus, getTrend } from "../../lib/watchlist-view";
import { ProductImage } from "../ProductImage";
import { WatchlistRowBadges } from "./WatchlistRowBadges";
import { WatchlistRowSparkline } from "./WatchlistRowSparkline";
import { WatchlistRowActions } from "./WatchlistRowActions";
import { StockBadge } from "../StockBadge";

type Insight = { atAllTimeLow: boolean; dropStreak: number };

export function WatchlistRow({
  product,
  virtual,
  displayCurrency,
  selectionMode,
  selectedId,
  selectedIds,
  insightMap,
  dealScores,
  tagDefinitions,
  findingIds,
  isAcquired,
  onOpen,
  onToggleSelection,
  onFindPrices,
  onToggleAcquired,
  onEditTags,
  onRemove,
}: {
  product: Product;
  virtual?: {
    ref: (el: HTMLTableRowElement | null) => void;
    index: number;
  };
  displayCurrency: string;
  selectionMode: boolean;
  selectedId: string | null;
  selectedIds: Set<string>;
  insightMap: Map<string, Insight>;
  dealScores: Map<string, DealScore | null>;
  tagDefinitions: Record<string, TagDefinition>;
  findingIds: Set<string>;
  isAcquired: (product: Product) => boolean;
  onOpen: (productId: string) => void;
  onToggleSelection: (productId: string) => void;
  onFindPrices: (product: Product) => void;
  onToggleAcquired: (
    e: React.MouseEvent,
    product: Product,
  ) => void | Promise<void>;
  onEditTags: (product: Product) => void;
  onRemove: (e: React.MouseEvent, productId: string) => void;
}) {
  // Virtualized rows re-render on every scroll tick; keep the per-row scans
  // (best-price over listings, trend over history) off that path.
  const best = useMemo(
    () => getBestPrice(product.listings ?? [], displayCurrency),
    [product.listings, displayCurrency],
  );
  const trend = useMemo(() => getTrend(product), [product]);
  const refreshed = product.lastRefreshed ?? product.addedAt;
  const acquired = useMemo(() => isAcquired(product), [product, isAcquired]);

  return (
    <tr
      key={product.id}
      ref={virtual?.ref}
      data-index={virtual?.index}
      aria-rowindex={virtual ? virtual.index + 1 : undefined}
      onClick={() => {
        if (selectionMode) {
          onToggleSelection(product.id);
          return;
        }
        onOpen(product.id);
      }}
      className={`border-b border-gray-100 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors duration-150 ${
        selectedId === product.id
          ? "bg-brand-50 dark:bg-brand-900/10 border-l-2 border-l-brand-500"
          : "border-l-2 border-l-transparent hover:border-l-brand-200"
      } ${selectedIds.has(product.id) ? "bg-brand-50/60 dark:bg-brand-900/20" : ""} ${
        acquired ? "opacity-55" : ""
      }`}
    >
      {selectionMode && (
        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedIds.has(product.id)}
            onChange={() => onToggleSelection(product.id)}
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
              <WatchlistRowBadges
                product={product}
                insight={insightMap.get(product.id)}
                dealScore={dealScores.get(product.id)}
                tagDefinitions={tagDefinitions}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {product.brand} · {product.modelNumber}
            </p>
            {(product.listings ?? []).length === 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFindPrices(product);
                }}
                disabled={findingIds.has(product.id)}
                className="mt-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50"
                aria-label="Find prices"
              >
                {findingIds.has(product.id) ? "Finding prices…" : "Find prices"}
              </button>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
        {(product.listings ?? []).length}
      </td>
      <td className="px-4 py-3">
        {best ? (
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {formatPrice(best.price, best.currency)}
          </span>
        ) : (
          <span className="text-sm text-gray-400">No price</span>
        )}
        <WatchlistRowSparkline listings={product.listings ?? []} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
        {(() => {
          const s = dealScores.get(product.id)?.score ?? null;
          return s != null ? (
            <span className="font-semibold" title={`Deal Score ${s}`}>
              {s}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          );
        })()}
      </td>
      <td className="px-4 py-3">
        <StockBadge status={getDominantStatus(product)} />
      </td>
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center gap-1 text-sm"
          role="img"
          aria-label={`Trend ${trend}`}
        >
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
      <WatchlistRowActions
        product={product}
        acquired={acquired}
        onToggleAcquired={onToggleAcquired}
        onEditTags={onEditTags}
        onRemove={onRemove}
      />
    </tr>
  );
}
