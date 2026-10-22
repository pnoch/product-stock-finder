import { lazy, Suspense } from "react";
import { BarChart3 } from "lucide-react";
import { CURRENCY_SYMBOLS } from "@shared/currency";

const MultiLineChart = lazy(() =>
  import("../MultiLineChart").then((m) => ({
    default: m.MultiLineChart,
  })),
);

export function PriceHistoryCard({
  productsCount,
  chartData,
  displayCurrency,
}: {
  productsCount: number;
  chartData: {
    data: Record<string, string | number>[];
    distributors: string[];
    distributorColors: string[];
  };
  displayCurrency: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h2 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Price History</h2>
      {productsCount > 3 && (
        <p className="text-xs text-gray-400 mt-1 mb-2">Top 3 of {productsCount} by value</p>
      )}
      {chartData.data.length > 0 ? (
        <Suspense fallback={null}>
          <MultiLineChart
            data={chartData.data}
            distributors={chartData.distributors}
            colors={chartData.distributorColors}
            currencySymbol={CURRENCY_SYMBOLS[displayCurrency] ?? "$"}
          />
        </Suspense>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
          <BarChart3 className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No price history yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-sm">
            Price points will appear here once distributors are tracked over time.
          </p>
        </div>
      )}
    </div>
  );
}
