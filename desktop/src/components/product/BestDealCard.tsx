import { DISTRIBUTORS } from "@shared/distributors";
import { formatPrice } from "@shared/currency";
import type { BestDeal } from "../../../../lib/best-deal";

export function BestDealCard({
  bestDeal,
  shippingRegion,
}: {
  bestDeal: BestDeal;
  shippingRegion: string;
}) {
  const distrib = DISTRIBUTORS.find((d) => d.id === bestDeal.distributorId);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Best Deal (incl. shipping to {shippingRegion})
      </p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-base font-bold">
          {distrib?.countryCode} {distrib?.name ?? bestDeal.distributorId}
        </p>
        <p className="text-lg font-bold text-brand-600 dark:text-brand-400">
          {formatPrice(bestDeal.total, bestDeal.currency)}
        </p>
      </div>
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
  );
}
