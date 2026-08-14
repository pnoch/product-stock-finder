import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { storage } from "../storage";
import { getDistributorById } from "../../../lib/distributors";
import { analyzeDistributors } from "../../../lib/distributor-analysis";
import type { DistributorAnalysis } from "../../../lib/distributor-analysis";
import { formatPrice } from "../../../lib/currency";
import { LoadingSpinner } from "../components/LoadingSpinner";

export function DistributorAnalysis() {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<DistributorAnalysis[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const watchlist = await storage.getWatchlist();
      const settings = await storage.getSettings();
      const currency = settings?.displayCurrency ?? "USD";
      setDisplayCurrency(currency);
      setAnalysis(analyzeDistributors(watchlist, currency));
    } catch {
      // Ignore load failures — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        <button
          onClick={() => navigate("/watchlist")}
          className="text-blue-600 dark:text-brand-400 mr-3"
        >
          ‹ Back
        </button>
        <h1 className="text-2xl font-bold">Distributor Analysis</h1>
      </div>

      {loading ? (
        <div className="flex justify-center mt-10">
          <LoadingSpinner />
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
