import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { storage } from "../storage";
import { getDistributorById } from "@shared/distributors";
import { analyzeDistributors } from "../../../lib/distributor-analysis";
import type { DistributorAnalysis } from "../../../lib/distributor-analysis";
import { formatPrice } from "@shared/currency";
import { LoadingSpinner } from "../components/LoadingSpinner";

export function DistributorAnalysis() {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<DistributorAnalysis[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const watchlist = await storage.getWatchlist();
      const settings = await storage.getSettings();
      const currency = settings?.displayCurrency ?? "USD";
      setDisplayCurrency(currency);
      setAnalysis(analyzeDistributors(watchlist, currency));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load distributor analysis");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        <button
          onClick={() => navigate("/watchlist")}
          className="text-blue-600 dark:text-brand-400 mr-3"
          aria-label="Go back to watchlist"
        >
          ‹ Back
        </button>
        <h1 className="text-2xl font-bold">Distributor Analysis</h1>
      </div>

      {loading ? (
        <div className="flex justify-center mt-10">
          <LoadingSpinner />
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <span className="flex-1">Couldn't load distributor analysis: {loadError}</span>
          <button
            onClick={() => void loadData()}
            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
            aria-label="Retry loading distributor analysis"
          >
            Retry
          </button>
        </div>
      ) : analysis.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-10">
          Add products to see distributor analysis.
        </p>
      ) : (
        <div>
          {analysis.map((a) => {
            const distrib = getDistributorById(a.distributorId);
            return (
              <div
                key={a.distributorId}
                className="flex items-center py-3 border-b border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {distrib?.countryFlag} {distrib?.name ?? a.distributorId}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {a.coverage} product{a.coverage !== 1 ? "s" : ""} · avg{" "}
                    {formatPrice(a.averagePrice, displayCurrency)} (incl. tax)
                  </p>
                </div>
                <p className="text-base font-bold text-brand-600 dark:text-brand-400">
                  {formatPrice(a.totalCost, displayCurrency)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
