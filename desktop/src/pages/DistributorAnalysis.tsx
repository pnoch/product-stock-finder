import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { storage } from "../storage";
import { useToast } from "../hooks/use-toast";
import { getDistributorById } from "@shared/distributors";
import { analyzeDistributors } from "../../../lib/distributor-analysis";
import type { DistributorAnalysis } from "../../../lib/distributor-analysis";
import { formatPrice } from "@shared/currency";
import { watchlistToDetailedCsv } from "../../../lib/csv";
import { LoadingSpinner } from "../components/LoadingSpinner";

export function DistributorAnalysis() {
  const navigate = useNavigate();
  const { showToast } = useToast();
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

  // Mobile's distributor-analysis screen exports the detailed listings CSV;
  // desktop's page had no export.
  const handleExport = useCallback(async () => {
    try {
      const watchlist = await storage.getWatchlist();
      if (watchlist.length === 0) {
        showToast("Add a product to your watchlist first");
        return;
      }
      const csv = watchlistToDetailedCsv(watchlist);
      const fileName = `distributor-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
      if (typeof window !== "undefined" && (window as unknown as { __TAURI__?: unknown }).__TAURI__) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeFile } = await import("@tauri-apps/plugin-fs");
        const filePath = await save({ defaultPath: fileName, filters: [{ name: "CSV", extensions: ["csv"] }] });
        if (!filePath) return;
        await writeFile(filePath, new TextEncoder().encode(csv));
        showToast(`Exported to ${filePath}`);
      } else {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Analysis exported as CSV");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "CSV export failed");
    }
  }, [showToast]);

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
        <h1 className="text-2xl font-bold flex-1">Distributor Analysis</h1>
        {analysis.length > 0 && (
          <button
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Export CSV"
          >
            Export CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center mt-10">
          <LoadingSpinner />
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <span className="flex-1">Couldn&apos;t load distributor analysis: {loadError}</span>
          <button
            onClick={() => void loadData()}
            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
            aria-label="Retry loading distributor analysis"
          >
            Retry
          </button>
        </div>
      ) : analysis.length === 0 ? (
        <div className="text-center mt-10">
          <p className="font-semibold text-gray-700 dark:text-gray-200">
            No distributor data yet
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
            Add a few products to your watchlist to compare coverage and average prices across distributors.
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => navigate("/search")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
              aria-label="Browse products"
            >
              Browse Products
            </button>
            <button
              onClick={() => void loadData()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label="Try again"
            >
              Try Again
            </button>
          </div>
        </div>
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
