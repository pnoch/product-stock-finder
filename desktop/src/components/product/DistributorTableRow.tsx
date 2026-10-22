import { Link } from "react-router";
import { BarChart3, Bell, Clock, ExternalLink, Eye, EyeOff } from "lucide-react";
import { DISTRIBUTORS } from "@shared/distributors";
import { formatPrice } from "@shared/currency";
import type { DistributorListing } from "../../../../lib/types";
import { formatLastRefreshed, getLastRefreshedColor } from "../../../../lib/last-refreshed";
import { convertPrice } from "@/lib/currency";
import { externalLinkHandler } from "../../lib/open-external";
import { PriceSparkline } from "../PriceSparkline";
import { StockBadge } from "../StockBadge";

export function DistributorTableRow({
  listing,
  bestListing,
  displayCurrency,
  stockWatches,
  productId,
  onToggleListingWatch,
  onShowHistory,
  onSetAlert,
  onSetReminder,
}: {
  listing: DistributorListing;
  bestListing: DistributorListing | null;
  displayCurrency: string;
  stockWatches: Record<string, boolean>;
  productId: string;
  onToggleListingWatch: (listing: DistributorListing) => void;
  onShowHistory: (listing: DistributorListing) => void;
  onSetAlert: (listing: DistributorListing) => void;
  onSetReminder: (listing: DistributorListing) => void;
}) {
  const dist = DISTRIBUTORS.find((d) => d.id === listing.distributorId);
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
            +{formatPrice(listing.price * listing.taxRate, listing.currency)}{" "}
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
            onClick={() => onSetAlert(listing)}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label={`Set alert for ${dist?.name ?? listing.distributorId}`}
            title="Set price alert for this distributor"
          >
            <Bell className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSetReminder(listing)}
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
}
