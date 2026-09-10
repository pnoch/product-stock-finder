import { Link } from "react-router";
import { Download } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Modal } from "./Modal";
import { useTheme } from "../hooks/use-theme";
import { convertPrice, CURRENCY_SYMBOLS } from "@shared/currency";
import { priceHistoryToCsv } from "../../../lib/csv";
import type { DistributorListing } from "../../../lib/types";

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
  const { isDark } = useTheme();
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
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={history.map((p) => ({
              date: new Date(p.date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              }),
              price: convertPrice(p.price, p.currency, displayCurrency),
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: isDark ? "#9ca3af" : "#6b7280" }} axisLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }} tickLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }} />
            <YAxis
              tick={{ fontSize: 12, fill: isDark ? "#9ca3af" : "#6b7280" }}
              axisLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }}
              tickLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }}
              tickFormatter={(v: number) =>
                `${CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency}${v.toFixed(0)}`
              }
            />
            <Tooltip
              cursor={{ stroke: isDark ? "#3B7DD8" : "#0F52BA", strokeDasharray: "4 4", strokeOpacity: 0.3 }}
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                return (
                  <div
                    className="rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 shadow-lg px-3 py-2 text-xs"
                    style={{ borderColor: isDark ? "#374151" : "#e5e7eb" }}
                  >
                    <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{label}</p>
                    {payload.map((entry: any, idx: number) => (
                      <p
                        key={idx}
                        className="flex items-center gap-2 animate-fadeIn"
                        style={{ animationDelay: `${idx * 60}ms` } as React.CSSProperties}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color ?? (isDark ? "#3B7DD8" : "#0F52BA") }} />
                        <span className="text-gray-500 dark:text-gray-400">{entry.name ?? "Price"}:</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {`${CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency}${Number(entry.value).toFixed(2)}`}
                        </span>
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke={isDark ? "#3B7DD8" : "#0F52BA"}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
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
