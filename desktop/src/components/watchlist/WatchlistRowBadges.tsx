import { dealBandLabel, type DealScore } from "../../../../lib/deal-score";
import type { Product, TagDefinition } from "../../../../lib/types";

export function WatchlistRowBadges({
  product,
  insight,
  dealScore,
  tagDefinitions,
}: {
  product: Product;
  insight: { atAllTimeLow: boolean; dropStreak: number } | undefined;
  dealScore: DealScore | null | undefined;
  tagDefinitions: Record<string, TagDefinition>;
}) {
  return (
    <>
      {insight && (insight.atAllTimeLow || insight.dropStreak >= 2) && (
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
      )}
      {dealScore?.band === "hot" && (
        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
          {dealBandLabel(dealScore.band)}
        </span>
      )}
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
    </>
  );
}
