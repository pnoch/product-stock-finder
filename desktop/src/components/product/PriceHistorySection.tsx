import { lazy, Suspense } from "react";
import type { PricePoint } from "../../../../lib/types";

const PriceHistoryChart = lazy(() =>
  import("../PriceHistoryChart").then((m) => ({
    default: m.PriceHistoryChart,
  })),
);

export function PriceHistorySection({
  history,
  displayCurrency,
}: {
  history: PricePoint[];
  displayCurrency: string;
}) {
  if (history.length < 2) return null;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-fadeIn transition-opacity duration-200">
      <h2 className="text-lg font-semibold mb-3">Price History</h2>
      <Suspense fallback={null}>
        <PriceHistoryChart history={history} displayCurrency={displayCurrency} />
      </Suspense>
    </div>
  );
}
