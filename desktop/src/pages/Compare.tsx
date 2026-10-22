import { useState, useRef } from "react";
import { useParams } from "react-router";
import { useToast } from "../hooks/use-toast";
import { formatPrice } from "@shared/currency";
import { StockBadge } from "../components/StockBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { SeriesChart } from "../components/compare/SeriesChart";
import { CompareHeader } from "../components/compare/CompareHeader";
import { CheapestByRegion } from "../components/compare/CheapestByRegion";
import { DistributorSelector } from "../components/compare/DistributorSelector";
import { CompareDistributorList } from "../components/compare/CompareDistributorList";
import { CrossAlertCard } from "../components/compare/CrossAlertCard";
import { CurrentPricesTable } from "../components/compare/CurrentPricesTable";
import { GitCompareArrows, TrendingDown } from "lucide-react";
import { useCompareData } from "../hooks/use-compare-data";
import { useCompareDerived } from "../hooks/use-compare-derived";
import { useCompareActions } from "../hooks/use-compare-actions";

export function Compare() {
  const { id } = useParams();
  const [timeRange, setTimeRange] = useState("3m");
  const [sortBy, setSortBy] = useState<"name" | "price" | "trend">("name");
  const [creatingAlert, setCreatingAlert] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const { toast, showToast } = useToast();
  const {
    product,
    loading,
    displayCurrency,
    loadError,
    selected,
    handleToggleSelect,
    loadCompare,
  } = useCompareData({ id, showToast });

  const {
    chartSeries,
    priceTrends,
    sortedListings,
    cheapest,
    regionBest,
    crossBest,
    alertTarget,
  } = useCompareDerived({
    product,
    selected,
    timeRange,
    sortBy,
    displayCurrency,
  });

  const {
    handleCrossAlert,
    handleShareCompare,
    handleSaveImage,
    handleExportCsv,
    getTrend,
  } = useCompareActions({
    id,
    product,
    alertTarget,
    displayCurrency,
    creatingAlert,
    setCreatingAlert,
    sortedListings,
    chartRef,
    showToast,
  });

  if (loading) return <LoadingSpinner size="large" label="Loading prices..." />;
  if (loadError)
    return (
      <div className="p-6 space-y-6">
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <span className="flex-1">Couldn&apos;t load comparison: {loadError}</span>
          <button
            onClick={() => void loadCompare()}
            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
            aria-label="Retry loading comparison"
          >
            Retry
          </button>
        </div>
      </div>
    );
  if (!product)
    return (
      <EmptyState
        icon={<GitCompareArrows className="w-12 h-12" />}
        title="Product not found"
        description="Go back to your watchlist and try again."
        action={{ label: "Back to watchlist", to: "/watchlist" }}
      />
    );

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm" role="status">
          {toast}
        </div>
      )}
      <CompareHeader
        product={product}
        loading={loading}
        timeRange={timeRange}
        onTimeRange={setTimeRange}
        onRefresh={() => void loadCompare()}
        onShare={() => void handleShareCompare()}
        onSaveImage={() => void handleSaveImage()}
        onExportCsv={() => void handleExportCsv()}
      />

      {cheapest && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-800">
              <TrendingDown className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                Best Price: {cheapest.distName}
              </p>
              <p className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
                {formatPrice(cheapest.price, cheapest.currency)}
              </p>
            </div>
            <div className="ml-auto">
              <StockBadge status={cheapest.stockStatus} />
            </div>
          </div>
        </div>
      )}

      <CheapestByRegion regionBest={regionBest} displayCurrency={displayCurrency} />

      {alertTarget !== null && crossBest !== null && (
        <CrossAlertCard
          alertTarget={alertTarget}
          crossBest={crossBest}
          displayCurrency={displayCurrency}
          onSetAlert={handleCrossAlert}
        />
      )}

      <CurrentPricesTable
        listings={sortedListings}
        selected={selected}
        displayCurrency={displayCurrency}
      />

      <DistributorSelector
        listings={sortedListings}
        selected={selected}
        priceTrends={priceTrends}
        onToggle={handleToggleSelect}
      />

      {chartSeries.length > 0 ? (
        <div ref={chartRef} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
            Price History ({displayCurrency})
          </h2>
          {/* Mobile's ChartCard shows this subtitle and range-specific hints. */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Select up to 5 distributors to overlay
          </p>
          {(timeRange === "6m" || timeRange === "1y") && (
            <p className="text-[11px] italic text-gray-500 dark:text-gray-400 mb-2">
              Showing all available history — up to 1Y retained (older points may be limited)
            </p>
          )}
          {timeRange === "all" && (
            <p className="text-[11px] italic text-gray-500 dark:text-gray-400 mb-2">
              Showing all available history
            </p>
          )}
          <SeriesChart series={chartSeries} displayCurrency={displayCurrency} />
          {chartSeries.length === 1 && (
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
              Add another distributor to compare
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center justify-center text-center">
          <div className="text-gray-300 dark:text-gray-600 mb-3">
            <GitCompareArrows className="w-10 h-10 mx-auto" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {sortedListings.filter((l) => l.priceHistory && l.priceHistory.length >= 2).length === 0
              ? "No price history yet"
              : "Select distributors to compare"}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            {sortedListings.filter((l) => l.priceHistory && l.priceHistory.length >= 2).length === 0
              ? "Price points will appear here once distributors have history. Try tracking more distributors or check back later."
              : "Use the selector above to choose up to 5 distributors with price history."}
          </p>
        </div>
      )}

      <CompareDistributorList
        listings={sortedListings}
        sortBy={sortBy}
        onSort={setSortBy}
        getTrend={getTrend}
      />
    </div>
  );
}
