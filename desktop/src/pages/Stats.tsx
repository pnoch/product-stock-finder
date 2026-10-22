import { useRef, useState } from "react";
import { useLocation } from "react-router";
import { Share2, RefreshCw } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import type { MoversWindow } from "../../../lib/watchlist-stats";
import { StatsSummaryCards } from "../components/stats/StatsSummaryCards";
import { DigestCard } from "../components/stats/DigestCard";
import { ProductInsightsCard } from "../components/stats/ProductInsightsCard";
import { DropCalendarCard } from "../components/stats/DropCalendarCard";
import { PriceHistoryCard } from "../components/stats/PriceHistoryCard";
import { StatsHealthCards } from "../components/stats/StatsHealthCards";
import { BasketAlertDialog } from "../components/stats/BasketAlertDialog";
import { StatsLoading, StatsError, StatsEmpty } from "../components/stats/StatsStates";
import { useStatsData } from "../hooks/use-stats-data";
import { useStatsDerived } from "../hooks/use-stats-derived";
import { useStatsActions } from "../hooks/use-stats-actions";



export function Stats() {
  const [now] = useState(() => Date.now());
  const [basketSheetOpen, setBasketSheetOpen] = useState(false);
  const [basketDraft, setBasketDraft] = useState("");
  const [days, setDays] = useState<MoversWindow>(30);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { pathname } = useLocation();
  const { toast, showToast } = useToast();
  const summaryRef = useRef<HTMLDivElement>(null);

  const {
    products,
    displayCurrency,
    digest,
    digestFrequency,
    digestPending,
    basketThreshold,
    loadError,
    refreshing,
    loading,
    loadStats,
    handleRefresh,
    handleSaveBasketAlert,
  } = useStatsData({ pathname, showToast });

  const {
    basket,
    stockHealth,
    movers,
    freshness,
    insights,
    topDeals,
    dropCalendar,
    dropCalendarCells,
    chartData,
  } = useStatsDerived({ products, displayCurrency, days, now });

  const { handleCopyText, handleSaveImage } = useStatsActions({
    products,
    displayCurrency,
    days,
    summaryRef,
    showToast,
  });

  if (loading) return <StatsLoading />;

  if (loadError && !products) {
    return <StatsError loadError={loadError} onRetry={() => void loadStats()} />;
  }

  if (!products || products.length === 0) {
    return <StatsEmpty />;
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 animate-fadeIn">
          {toast}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleRefresh()}
            disabled={loading || refreshing}
            aria-label="Refresh stats"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
          <button
            onClick={handleCopyText}
            disabled={!products || products.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium disabled:opacity-50"
            aria-label="Copy stats as text"
          >
            <Share2 className="w-4 h-4" />
            Copy text
          </button>
          <button
            onClick={handleSaveImage}
            disabled={!products || products.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium disabled:opacity-50"
            aria-label="Save stats as image"
          >
            <Share2 className="w-4 h-4" />
            Save image
          </button>
        </div>
      </div>
      {loadError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <span className="flex-1">Couldn&apos;t load statistics: {loadError}</span>
          <button
            onClick={() => void loadStats()}
            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
            aria-label="Retry loading statistics"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex items-center gap-1" role="group" aria-label="Movers window">
        {(
          [
            { label: "7D", value: 7 },
            { label: "30D", value: 30 },
            { label: "All", value: null },
          ] as { label: string; value: MoversWindow }[]
        ).map((opt) => (
          <button
            key={opt.label}
            onClick={() => setDays(opt.value)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              days === opt.value
                ? "bg-brand-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            aria-label={`Select movers window: ${opt.label}`}
            aria-pressed={days === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div ref={summaryRef}>
        <StatsSummaryCards
          basket={basket}
          basketThreshold={basketThreshold}
          displayCurrency={displayCurrency}
          stockHealth={stockHealth}
          movers={movers}
          onEditBasketAlert={() => {
            setBasketDraft(basketThreshold != null ? String(basketThreshold) : "");
            setBasketSheetOpen(true);
          }}
        />
      </div>

      {products.length === 0 ? null : (
        <DigestCard
          digest={digest}
          digestFrequency={digestFrequency}
          digestPending={digestPending}
          displayCurrency={displayCurrency}
          topDeals={topDeals}
        />
      )}

      {insights && <ProductInsightsCard insights={insights} />}

      <DropCalendarCard
        dropCalendar={dropCalendar}
        dropCalendarCells={dropCalendarCells}
        selectedKey={selectedKey}
        onSelectKey={setSelectedKey}
        displayCurrency={displayCurrency}
      />

      <PriceHistoryCard
        productsCount={products.length}
        chartData={chartData}
        displayCurrency={displayCurrency}
      />

      <StatsHealthCards freshness={freshness} stockHealth={stockHealth} />

      <BasketAlertDialog
        open={basketSheetOpen}
        displayCurrency={displayCurrency}
        draft={basketDraft}
        threshold={basketThreshold}
        onDraftChange={setBasketDraft}
        onClose={() => setBasketSheetOpen(false)}
        onSave={handleSaveBasketAlert}
      />
    </div>
  );
}
