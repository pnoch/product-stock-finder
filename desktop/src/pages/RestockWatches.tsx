import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Trash2 } from "lucide-react";
import { storage } from "../storage";
import { useToast } from "../hooks/use-toast";
import { getDistributorById } from "@shared/distributors";
import { StockBadge } from "../components/StockBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type { BackOrderReminder, StockStatus } from "../../../lib/types";

export function RestockWatches() {
  const navigate = useNavigate();
  const [watches, setWatches] = useState<BackOrderReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  const loadWatches = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await storage.getStockWatches();
      setWatches(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load restock watches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWatches();
  }, [loadWatches]);

  const handleRemove = useCallback(async (id: string) => {
    try {
      await storage.removeStockWatch(id);
      setWatches((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't remove watch");
    }
  }, [showToast]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-[60] animate-fadeIn">
          {toast}
        </div>
      )}
      <div className="flex items-center mb-4">
        <button
          onClick={() => navigate("/alerts")}
          className="text-blue-600 dark:text-brand-400 mr-3"
          aria-label="Go back to alerts"
        >
          ‹ Back
        </button>
        <h1 className="text-2xl font-bold">Restock Watches</h1>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 mb-6 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <span className="flex-1">Couldn't load restock watches: {loadError}</span>
          <button
            onClick={() => void loadWatches()}
            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
            aria-label="Retry loading restock watches"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center mt-10">
          <LoadingSpinner />
        </div>
      ) : watches.length === 0 ? (
        <div className="text-center mt-10">
          <p className="text-center text-gray-500 dark:text-gray-400">
            No restock watches. Open a product and tap &quot;Watch for
            Restock&quot; to add one.
          </p>
          <Link
            to="/watchlist"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
            aria-label="Browse watchlist"
          >
            Browse watchlist
          </Link>
        </div>
      ) : (
        <div>
          {watches.map((watch) => {
            const distrib = getDistributorById(watch.distributorId);
            return (
              <div
                key={watch.id}
                className="flex items-center py-3 border-b border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1">
                  <Link
                    to={`/product/${watch.productId}`}
                    className="font-medium text-sm hover:underline"
                    aria-label={`View ${watch.productName} details`}
                  >
                    {watch.productName}
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {distrib?.countryFlag}{" "}
                    {distrib?.name ?? watch.distributorName}
                  </p>
                  <div className="mt-1">
                    <StockBadge
                      status={
                        (watch.lastKnownStatus ?? "unknown") as StockStatus
                      }
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(watch.id)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                  aria-label={`Remove ${watch.productName} from restock watches`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
