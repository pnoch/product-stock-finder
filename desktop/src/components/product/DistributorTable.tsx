import type { BestDeal } from "../../../../lib/best-deal";
import type { DistributorListing } from "../../../../lib/types";
import { DistributorRegionFilter } from "./DistributorRegionFilter";
import { BestDealCard } from "./BestDealCard";
import { DistributorTableRow } from "./DistributorTableRow";
import { DistributorTableEmpty } from "./DistributorTableEmpty";

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
      <DistributorRegionFilter
        regions={regions}
        regionFilter={regionFilter}
        onRegionChange={onRegionChange}
      />
      {bestDeal && (
        <BestDealCard bestDeal={bestDeal} shippingRegion={shippingRegion} />
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
            {visibleListings.map((listing) => (
              <DistributorTableRow
                key={`${listing.distributorId}-${listing.currency}`}
                listing={listing}
                bestListing={bestListing}
                displayCurrency={displayCurrency}
                stockWatches={stockWatches}
                productId={productId}
                onToggleListingWatch={onToggleListingWatch}
                onShowHistory={onShowHistory}
                onSetAlert={onSetAlert}
                onSetReminder={onSetReminder}
              />
            ))}
          </tbody>
        </table>
        {visibleListings.length === 0 && (
          <DistributorTableEmpty
            regionFilter={regionFilter}
            productListingsCount={productListingsCount}
            findingPrices={findingPrices}
            onRegionChange={onRegionChange}
            onFindPrices={onFindPrices}
          />
        )}
      </div>
    </div>
  );
}
