import { Link } from "react-router";
import {
  BarChart3,
  Bell,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
import { DISTRIBUTORS } from "@shared/distributors";
import { formatPrice } from "@shared/currency";
import type { BestDeal } from "../../../../lib/best-deal";
import type { DistributorListing } from "../../../../lib/types";
import {
  formatLastRefreshed,
  getLastRefreshedColor,
} from "../../../../lib/last-refreshed";
import { convertPrice } from "../../../../lib/currency";
import { externalLinkHandler } from "../../lib/open-external";
import { PriceSparkline } from "../PriceSparkline";
import { StockBadge } from "../StockBadge";

export function DistributorTable({
  productId,
  productListingsCount,
  visibleListings,
  regions,
  regionFilter,
  onRegionChange,
  bestDeal,
  shippingRegion,
  bestListing,
  displayCurrency,
  stockWatches,
  onToggleListingWatch,
  onShowHistory,
  onSetAlert,
  onSetReminder,
  onFindPrices,
  findingPrices,
}: {
  productId: string;
  productListingsCount: number;
  visibleListings: DistributorListing[];
  regions: string[];
  regionFilter: string;
  onRegionChange: (region: string) => void;
  bestDeal: BestDeal | null;
  shippingRegion: string;
  bestListing: DistributorListing | null;
  displayCurrency: string;
  stockWatches: Record<string, boolean>;
  onToggleListingWatch: (listing: DistributorListing) => void;
  onShowHistory: (listing: DistributorListing) => void;
  onSetAlert: (listing: DistributorListing) => void;
  onSetReminder: (listing: DistributorListing) => void;
  onFindPrices: () => void;
  findingPrices: boolean;
}) {
  return (
      <div className="transition-opacity duration-200">
        <h2 className="text-lg font-semibold mb-3">
          All Listings ({visibleListings.length})
        </h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {["all", ...regions].map((region) => (
            <button
              key={region}
              onClick={() => onRegionChange(region)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                regionFilter === region
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
              aria-label={region === "all" ? "Filter by all regions" : `Filter by ${region} region`}
              aria-pressed={regionFilter === region}
            >
              {region === "all" ? "All" : region}
            </button>
          ))}
        </div>
        {bestDeal && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Best Deal (incl. shipping to {shippingRegion})
            </p>
            {(() => {
              const distrib = DISTRIBUTORS.find(
                (d) => d.id === bestDeal.distributorId,
              );
              return (
                <div className="flex items-center justify-between mt-2">
                  <p className="text-base font-bold">
                    {distrib?.countryCode}{" "}
                    {distrib?.name ?? bestDeal.distributorId}
                  </p>
                  <p className="text-lg font-bold text-brand-600 dark:text-brand-400">
                    {formatPrice(bestDeal.total, bestDeal.currency)}
                  </p>
                </div>
              );
            })()}
            <div className="flex gap-4 mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Price: {formatPrice(bestDeal.price, bestDeal.currency)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tax:{" "}
                {bestDeal.tax > 0
                  ? formatPrice(bestDeal.tax, bestDeal.currency)
                  : "Tax-free"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ship: {bestDeal.shipping === null ? "N/A" : formatPrice(bestDeal.shipping, bestDeal.currency)}
              </p>
            </div>
          </div>
        )}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Distributor
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Checked
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleListings.map((listing) => {
                const dist = DISTRIBUTORS.find(
                  (d) => d.id === listing.distributorId,
                );
                const isBest =
                  bestListing &&
                  listing.distributorId === bestListing.distributorId &&
                  listing.currency === bestListing.currency;
                const isWatching = !!stockWatches[listing.distributorId];
                const convertedPrice =
                  listing.currency !== displayCurrency
                    ? convertPrice(listing.price, listing.currency, displayCurrency)
                    : null;
                const canWatch =
                  listing.stockStatus === "back_order" ||
                  listing.stockStatus === "out_of_stock";

                return (
                  <tr
                    key={`${listing.distributorId}-${listing.currency}`}
                    className={`border-b border-gray-100 dark:border-gray-700/50 last:border-0 transition-colors duration-200 ${isBest ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-l-2 border-l-emerald-400" : "hover:bg-gray-50 dark:hover:bg-gray-700/30"}`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">
                          {dist?.name ?? listing.distributorId}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {dist?.country}
                          {dist?.region ? ` · ${dist.region}` : ""} {dist?.countryCode}
                        </p>
                        {dist?.paymentMethods && dist.paymentMethods.length > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate" title={dist.paymentMethods.join(" · ")}>
                            {dist.paymentMethods.join(" · ")}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold">
                        {formatPrice(listing.price, listing.currency)}
                      </span>
                      {convertedPrice !== null && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ≈ {formatPrice(convertedPrice, displayCurrency)}
                        </p>
                      )}
                      {listing.priceHistory && listing.priceHistory.length >= 2 && (
                        <button onClick={() => onShowHistory(listing)} aria-label={`View ${dist?.name ?? listing.distributorId} price history`} className="mt-1 block">
                          <PriceSparkline history={listing.priceHistory} currency={listing.currency} />
                        </button>
                      )}
                      {listing.taxRate != null && listing.taxRate > 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          +
                          {formatPrice(
                            listing.price * listing.taxRate,
                            listing.currency,
                          )}{" "}
                          tax
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Tax-free
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StockBadge
                        status={listing.stockStatus}
                        expectedDate={listing.expectedDate}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {(() => {
                        // Mobile's DistributorListingCard colors the freshness
                        // text (green <1h, amber <6h, red older); desktop's cell
                        // was always gray.
                        const key = getLastRefreshedColor(listing.lastChecked);
                        const cls =
                          key === "green"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : key === "yellow"
                              ? "text-amber-600 dark:text-amber-400"
                              : key === "red"
                                ? "text-red-600 dark:text-red-400"
                                : "text-gray-500 dark:text-gray-400";
                        return (
                          <span className={cls}>
                            Updated {formatLastRefreshed(listing.lastChecked)}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canWatch && (
                          <button
                            onClick={() => onToggleListingWatch(listing)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isWatching ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                            aria-label={isWatching ? "Stop watching for restock" : "Watch for restock"}
                            title={isWatching ? "Watching — click to stop" : "Watch for restock"}
                          >
                            {isWatching ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            {isWatching ? "Watching" : "Watch"}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            onSetAlert(listing);
                          }}
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          aria-label={`Set alert for ${dist?.name ?? listing.distributorId}`}
                          title="Set price alert for this distributor"
                        >
                          <Bell className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            onSetReminder(listing);
                          }}
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          aria-label={`Set reminder for ${dist?.name ?? listing.distributorId}`}
                          title="Set reminder for this distributor"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                        {listing.priceHistory && listing.priceHistory.length >= 2 ? (
                          <button
                            onClick={() => onShowHistory(listing)}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            aria-label={`View ${dist?.name ?? listing.distributorId} price history`}
                            title="View price history"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <Link
                            to={`/compare/${productId}?distributor=${listing.distributorId}`}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            aria-label={`View ${dist?.name ?? listing.distributorId} price history`}
                            title="View price history"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                          </Link>
                        )}
                        <a
                          href={listing.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={externalLinkHandler(listing.url)}
                          className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 text-sm hover:underline px-1.5 py-1"
                          aria-label={`Visit ${dist?.name ?? listing.distributorId}`}
                        >
                          Visit <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleListings.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {regionFilter !== "all" ? (
                <>
                  <p>{`No distributors in ${regionFilter}.`}</p>
                  {/* Mobile's empty region state offers a Show All button. */}
                  <button
                    onClick={() => onRegionChange("all")}
                    className="mt-3 inline-flex items-center px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
                    aria-label="Show all regions"
                  >
                    Show All
                  </button>
                </>
              ) : productListingsCount === 0 ? (
                <>
                  <p>No distributor listings available.</p>
                  <button
                    onClick={() => void onFindPrices()}
                    disabled={findingPrices}
                    className="mt-3 inline-flex items-center px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-60"
                    aria-label="Find prices"
                  >
                    {findingPrices ? "Finding prices…" : "Find prices"}
                  </button>
                </>
              ) : (
                "No distributor listings available."
              )}
            </div>
          )}
        </div>
      </div>

  );
}
