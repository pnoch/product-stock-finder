import { Link } from "react-router";
import { Download } from "lucide-react";
import { Modal } from "./Modal";
import { priceHistoryToCsv } from "../../../lib/csv";
import type { DistributorListing } from "../../../lib/types";
import { PriceHistoryChart } from "./PriceHistoryChart";

export function DistributorHistoryModal({
  open,
  onClose,
  productId,
  productName,
  listing,
  distributorName,
  displayCurrency,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName?: string;
  listing: DistributorListing | null;
  distributorName: string;
  displayCurrency: string;
}) {
  const history = listing?.priceHistory ?? [];

  const handleDownloadCsv = () => {
    if (!listing) return;
    const csv = priceHistoryToCsv(listing.priceHistory, { name: distributorName, modelNumber: productId });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${productId}-${listing.distributorId}-history.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal open={open} onClose={onClose} title={distributorName}>
      {productName ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{productName}</p>
      ) : null}
      {history.length >= 2 ? (
        <PriceHistoryChart history={history} displayCurrency={displayCurrency} />
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">No price history available.</p>
      )}
      <div className="flex justify-end gap-2 pt-4">
        <button
          onClick={handleDownloadCsv}
          disabled={!listing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
          aria-label="Download CSV"
        >
          <Download className="w-4 h-4" />
          Download CSV
        </button>
        {listing ? (
          <Link
            to={`/compare/${productId}?distributor=${listing.distributorId}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Full comparison
          </Link>
        ) : null}
      </div>
    </Modal>
  );
}
