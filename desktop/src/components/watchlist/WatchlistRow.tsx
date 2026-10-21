import {
  CheckCircle,
  Minus,
  Tag as TagIcon,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { formatPrice } from "@shared/currency";
import { getBestPrice } from "../../../../lib/currency";
import { formatLastRefreshed } from "../../../../lib/last-refreshed";
import { dealBandLabel, type DealScore } from "../../../../lib/deal-score";
import type { Product, TagDefinition } from "../../../../lib/types";
import { getDominantStatus, getTrend } from "../../lib/watchlist-view";
import { ProductImage } from "../ProductImage";
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
  const best = getBestPrice(product.listings ?? [], displayCurrency);
  const trend = getTrend(product);
  const refreshed = product.lastRefreshed ?? product.addedAt;
  const acquired = isAcquired(product);

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
              {(() => {
                const insight = insightMap.get(product.id);
                if (
                  !insight ||
                  !(insight.atAllTimeLow || insight.dropStreak >= 2)
                )
                  return null;
                return (
                  <>
                    {insight.atAllTimeLow && (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        All-time low
                      </span>
                    )}
                    {insight.dropStreak >= 2 && (
                      <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                        ▼ Dropping ×{insight.dropStreak}
                      </span>
                    )}
                  </>
                );
              })()}
              {(() => {
                const d = dealScores.get(product.id);
                return d?.band === "hot" ? (
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    {dealBandLabel(d.band)}
                  </span>
                ) : null;
              })()}
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
              {(product.tags ?? []).filter((id) => tagDefinitions[id]).length ===
                0 &&
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
        {(() => {
          const history = (product.listings ?? [])
            .flatMap((l) => l.priceHistory ?? [])
            .sort(
              (a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime(),
            )
            .slice(-10);
          if (history.length < 2) return null;
          const prices = history.map((p) => p.price);
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          const range = max - min || 1;
          const w = 64,
            h = 24,
            pad = 3;
          const coords = history
            .map((p, i) => {
              const x = pad + (i / (history.length - 1)) * (w - pad * 2);
              const y = pad + (1 - (p.price - min) / range) * (h - pad * 2);
              return `${x},${y}`;
            })
            .join(" ");
          const color =
            prices[prices.length - 1]! >= prices[0]!
              ? range === 0
                ? "#9CA3AF"
                : "#EF4444"
              : "#10B981";
          return (
            <svg
              width={w}
              height={h}
              className="mt-1 block"
              role="img"
              aria-label={`Price sparkline ${history.length} point${
                history.length === 1 ? "" : "s"
              }`}
            >
              <polyline
                points={coords}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle
                cx={Number(coords.split(" ").pop()!.split(",")[0])}
                cy={Number(coords.split(" ").pop()!.split(",")[1])}
                r={2.5}
                fill={color}
              />
            </svg>
          );
        })()}
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
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={(e) => void onToggleAcquired(e, product)}
          onKeyDown={(e) => e.stopPropagation()}
          className={`p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
            acquired
              ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30"
          }`}
          aria-label={acquired ? "Mark as not acquired" : "Mark as acquired"}
          aria-pressed={acquired}
        >
          <CheckCircle className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditTags(product);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label={`Edit tags for ${product.name}`}
        >
          <TagIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => onRemove(e, product.id)}
          onKeyDown={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          aria-label={`Remove ${product.name} from watchlist`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
