import { formatPrice } from "@shared/currency";
import type { DealScore } from "../../../../lib/deal-score";
import { dealBandLabel } from "../../../../lib/deal-score";
import type { PriceVsAverage } from "../../../../lib/price-average";

export function ProductInsightCards({
  dealScore,
  priceVsAvg,
  insight,
  insightLoading,
  displayCurrency,
}: {
  dealScore: DealScore | null;
  priceVsAvg: PriceVsAverage | null;
  insight: string | null;
  insightLoading: boolean;
  displayCurrency: string;
}) {
  return (
    <>
      {dealScore != null && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
            Deal Score {dealScore.score} — {dealBandLabel(dealScore.band)}
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Range {dealScore.factors.range}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Trend {dealScore.factors.trend}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Streak {dealScore.factors.streak}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Volatility {dealScore.factors.volatility}</span>
          </div>
        </div>
      )}

      {priceVsAvg && (
        <div
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4"
          aria-label={`${priceVsAvg.verdict === "below" ? "▼" : priceVsAvg.verdict === "above" ? "▲" : "—"} ${priceVsAvg.percentVsAvg > 0 ? "+" : ""}${priceVsAvg.percentVsAvg.toFixed(1)}% versus 30-day average — ${priceVsAvg.verdict === "below" ? "Below average — good time to buy" : priceVsAvg.verdict === "above" ? "Above average" : "Around its average"}`}
        >
          <span
            className={`text-2xl font-bold shrink-0 min-w-[84px] ${
              priceVsAvg.verdict === "below"
                ? "text-emerald-600 dark:text-emerald-400"
                : priceVsAvg.verdict === "above"
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {priceVsAvg.verdict === "below" ? "▼" : priceVsAvg.verdict === "above" ? "▲" : "—"}{" "}
            {priceVsAvg.percentVsAvg > 0 ? "+" : ""}
            {priceVsAvg.percentVsAvg.toFixed(1)}%
          </span>
          <div className="flex-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              vs 30-day average · avg {formatPrice(priceVsAvg.average, displayCurrency)}
            </p>
            <p className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">
              {priceVsAvg.verdict === "below"
                ? "Below average — good time to buy"
                : priceVsAvg.verdict === "above"
                  ? "Above average"
                  : "Around its average"}
            </p>
          </div>
        </div>
      )}

      {insightLoading ? (
        <div
          role="status"
          aria-label="Loading insight"
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse"
        >
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mt-2 h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ) : insight ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            AI insight
          </p>
          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
            {insight}
          </p>
        </div>
      ) : null}

    </>
  );
}
