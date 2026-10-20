import { DISTRIBUTORS } from "@shared/distributors";
import { formatPrice } from "@shared/currency";
import {
  alertDeltaPct,
  productWideAlert,
  scopedAlertFor,
} from "../../../../lib/alert-scope";
import type { DistributorListing, PriceAlert } from "../../../../lib/types";

export function DistributorTargets({
  productId,
  listings,
  alerts,
  onSetTarget,
}: {
  productId: string;
  listings: DistributorListing[];
  alerts: PriceAlert[];
  onSetTarget: (listing: DistributorListing) => void;
}) {
  return (
      listings.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-lg font-semibold mb-3">Distributor Targets</h2>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {listings.map((listing) => {
              const dist = DISTRIBUTORS.find((d) => d.id === listing.distributorId);
              const name = dist?.name ?? listing.distributorId;
              // Scoped alert only (matching mobile's TargetTableCard): a
              // product-wide alert must not occupy the row, or its "+" button
              // disappears and no per-distributor target can be added. The wide
              // alert is shown in the footer.
              const alert = scopedAlertFor(alerts, productId, listing.distributorId, listing.currency);
              const deltaPct = alert ? alertDeltaPct(listing, alert) : null;
              return (
                <li key={`${listing.distributorId}-${listing.currency}`} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {dist?.countryCode ? `${dist.countryCode} ` : ""}
                      {name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {formatPrice(listing.price, listing.currency)}
                      {alert && (
                        <span className="text-gray-500 dark:text-gray-400">
                          {" "}· target {formatPrice(alert.targetPrice, alert.currency)}
                        </span>
                      )}
                      {deltaPct !== null && (
                        <span
                          className={`ml-1.5 font-semibold ${deltaPct <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"}`}
                        >
                          {deltaPct > 0 ? `+${deltaPct}%` : `${deltaPct}%`}
                        </span>
                      )}
                    </p>
                  </div>
                  {!alert && (
                    <button
                      onClick={() => onSetTarget(listing)}
                      className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-lg font-medium leading-none"
                      aria-label={`Set target for ${name}`}
                      title={`Set target for ${name}`}
                    >
                      +
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {(() => {
            // Mobile's TargetTableCard shows the product-wide alert footer and an
            // empty-state hint; desktop omitted both.
            const wide = productWideAlert(alerts, productId);
            const anyScoped = listings.some((l) =>
              scopedAlertFor(alerts, productId, l.distributorId, l.currency),
            );
            if (wide) {
              return (
                <p className="text-xs text-gray-500 dark:text-gray-400 pt-3">
                  Any distributor · target {formatPrice(wide.targetPrice, wide.currency)}
                </p>
              );
            }
            if (!anyScoped) {
              return (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  Set per-distributor targets with + to compare them here.
                </p>
              );
            }
            return null;
          })()}
        </div>
      )
  );
}
