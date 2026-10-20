import { Bell, ExternalLink, Loader2 } from "lucide-react";
import { formatPrice } from "@shared/currency";
import type { DistributorListing } from "../../../../lib/types";
import { externalLinkHandler } from "../../lib/open-external";
import { PriceSparkline } from "../PriceSparkline";
import { StockBadge } from "../StockBadge";

type DistributorInfo = {
  name: string;
  country: string;
  countryCode: string;
};

export function BestDistributorCard({
  productName,
  best,
  bestListing,
  bestDistributor,
  trendSignal,
  isLowestEver,
  livePriceLoading,
  onQuickAlert,
}: {
  productName: string;
  best: { price: number; currency: string } | null;
  bestListing: DistributorListing | null | undefined;
  bestDistributor: DistributorInfo | null | undefined;
  trendSignal: { down: boolean; pct: number } | null;
  isLowestEver: boolean;
  livePriceLoading: boolean;
  onQuickAlert: () => void;
}) {
  if (!best || !bestListing || !bestDistributor) return null;
  return (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">
                Best Price
              </p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {formatPrice(best.price, best.currency)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {bestDistributor.name} · {bestDistributor.country}{" "}
                {bestDistributor.countryCode}
              </p>
              {/* Mobile's BestDistributorCard explains why this is best. */}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {bestListing.stockStatus === "in_stock"
                  ? "Cheapest in-stock option"
                  : bestListing.stockStatus === "back_order"
                    ? "Cheapest orderable option"
                    : "Cheapest available option"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StockBadge
                status={bestListing.stockStatus}
                expectedDate={bestListing.expectedDate}
              />
              <PriceSparkline history={bestListing.priceHistory ?? []} currency={bestListing.currency} />
            </div>
          </div>
          {trendSignal && (
            <p
              className={`mt-1 text-sm font-medium ${trendSignal.down ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}
            >
              {trendSignal.down ? "▼" : "▲"} {trendSignal.pct}%
            </p>
          )}
          {isLowestEver ? (
            <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
              Lowest Price Ever
            </p>
          ) : null}
          {(() => {
            const suggested = Math.round(bestListing.price * 0.95 * 100) / 100;
            const label = `Set Alert at ${formatPrice(suggested, bestListing.currency)} (−5%)`;
            return (
              <button
                type="button"
                onClick={onQuickAlert}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                aria-label={label}
              >
                <Bell className="w-3.5 h-3.5" /> {label}
              </button>
            );
          })()}
          {livePriceLoading ? (
            <button
              type="button"
              disabled
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              aria-label="Loading price"
            >
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
              </>
            </button>
          ) : bestListing.stockStatus !== "in_stock" ? (
            <a
              href={bestListing.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={externalLinkHandler(bestListing.url)}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 bg-gray-600 text-white hover:bg-gray-500 cursor-pointer"
              aria-label={`Buy ${productName} at ${bestDistributor.name} (currently ${bestListing.stockStatus === "back_order" ? "on back order" : "out of stock"})`}
            >
              {bestListing.stockStatus === "back_order" ? (
                <>Back Order <ExternalLink className="w-3.5 h-3.5" /></>
              ) : (
                <>Out of Stock <ExternalLink className="w-3.5 h-3.5" /></>
              )}
            </a>
          ) : (
            <a
              href={bestListing.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={externalLinkHandler(bestListing.url)}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
              aria-label={`Buy ${productName} at ${bestDistributor.name}`}
            >
              Buy Now <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
  );
}
