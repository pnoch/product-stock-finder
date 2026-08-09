import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Trash2 } from "lucide-react";
import { storage } from "../storage";
import { getDistributorById } from "../../../lib/distributors";
import { StockBadge } from "../components/StockBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type { BackOrderReminder, StockStatus } from "../../../lib/types";

export function RestockWatches() {
  const navigate = useNavigate();
  const [watches, setWatches] = useState<BackOrderReminder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWatches = useCallback(async () => {
    try {
      const list = await storage.getStockWatches();
      setWatches(list);
    } catch {
      // Ignore load failures — show empty state
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
    } catch {
      // Ignore remove failures — the watch stays in the list
    }
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        <button
          onClick={() => navigate("/alerts")}
          className="text-blue-600 dark:text-brand-400 mr-3"
        >
          ‹ Back
        </button>
        <h1 className="text-2xl font-bold">Restock Watches</h1>
      </div>

      {loading ? (
        <div className="flex justify-center mt-10">
          <LoadingSpinner />
        </div>
      ) : watches.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-10">
          No restock watches. Open a product and tap "Watch for Restock" to add one.
        </p>
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
                  <p className="font-medium text-sm">{watch.productName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {distrib?.countryFlag} {distrib?.name ?? watch.distributorName}
                  </p>
                  <div className="mt-1">
                    <StockBadge
                      status={(watch.lastKnownStatus ?? "unknown") as StockStatus}
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(watch.id)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
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
