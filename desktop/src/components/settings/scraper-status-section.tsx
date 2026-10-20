import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { getDistributorById } from "@shared/distributors";
import { getAllParserIds } from "../../../../lib/scrapers/registry";
import { clearDistributorBreaker } from "../../../../lib/scrapers/breaker-clear";
import type { StorageAdapter } from "../../../../lib/storage/adapter";
import type { Product } from "../../../../lib/types";
import { storage } from "../../storage";
import { useToast } from "../../hooks/use-toast";

type DistributorStatus = {
  lastSuccess: string | null;
  lastError: string | null;
  consecutiveFailures: number;
};

function getDistributorHealth(
  lastSuccess: string | null,
  nowMs: number,
): { label: string; dot: string } {
  if (!lastSuccess) {
    return { label: "Never Checked", dot: "bg-gray-400" };
  }
  const hoursSince =
    (nowMs - new Date(lastSuccess).getTime()) / (1000 * 60 * 60);
  if (hoursSince < 24) {
    return { label: "OK", dot: "bg-emerald-500" };
  }
  if (hoursSince < 168) {
    return { label: "Stale", dot: "bg-amber-500" };
  }
  return { label: "Failed", dot: "bg-red-500" };
}

export function ScraperStatusSection({ now }: { now: number }) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [reenabling, setReenabling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    storage
      .getWatchlist()
      .then((w) => {
        if (!cancelled) setProducts(w);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const distributorStatuses = useMemo(() => {
    const statuses: Record<string, DistributorStatus> = {};
    for (const id of getAllParserIds()) {
      statuses[id] = {
        lastSuccess: null,
        lastError: null,
        consecutiveFailures: 0,
      };
    }
    for (const product of products) {
      if (!product.listings) continue;
      for (const listing of product.listings) {
        const id = listing.distributorId;
        if (!statuses[id]) {
          statuses[id] = {
            lastSuccess: null,
            lastError: null,
            consecutiveFailures: 0,
          };
        }
        if (listing.lastChecked) {
          const existing = statuses[id].lastSuccess;
          if (!existing || listing.lastChecked > existing) {
            statuses[id].lastSuccess = listing.lastChecked;
          }
        }
      }
    }
    return statuses;
  }, [products]);

  const handleReenableDistributor = useCallback(
    async (distributorId: string) => {
      if (reenabling) return;
      setReenabling(true);
      try {
        // Only clear the circuit breaker so the next price check attempts the
        // fetch again. Do NOT stamp lastChecked: that field means "last
        // successful check", so stamping it made a failed distributor show
        // "OK / Last checked: today" with no prices actually fetched.
        const breakerAdapter: Pick<StorageAdapter, "getItem" | "setItem"> = {
          getItem: async (k: string) => localStorage.getItem(k),
          setItem: async (k: string, v: string) => localStorage.setItem(k, v),
        };
        await clearDistributorBreaker(distributorId, breakerAdapter).catch(
          () => {},
        );
        showToast("Distributor re-enabled");
      } catch {
        showToast("Could not re-enable distributor");
      } finally {
        setReenabling(false);
      }
    },
    [reenabling, showToast],
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-3 mb-4">
        <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        <h2 className="text-lg font-semibold">Scraper Status</h2>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {productsLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
            Loading distributor status…
          </p>
        ) : (
          <>
            {Object.entries(distributorStatuses)
              .filter(([id]) => getDistributorById(id))
              .map(([id, status]) => {
                const distributor = getDistributorById(id)!;
                const health = getDistributorHealth(status.lastSuccess, now);
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        <span
                          aria-hidden="true"
                          className={`inline-block w-2 h-2 rounded-full mr-1.5 align-middle ${health.dot}`}
                        />
                        {distributor.countryCode} {distributor.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {status.lastSuccess
                          ? `Last checked: ${new Date(status.lastSuccess).toLocaleDateString()}`
                          : "Never checked"}
                      </p>
                    </div>
                    {health.label !== "OK" ? (
                      <button
                        onClick={() => handleReenableDistributor(id)}
                        disabled={reenabling}
                        className="ml-2 shrink-0 px-3 py-1.5 rounded-lg bg-brand-600/10 text-brand-600 dark:text-brand-400 text-xs font-semibold hover:bg-brand-600/20 disabled:opacity-50"
                        aria-label={`Re-enable ${distributor.name}`}
                      >
                        Re-enable
                      </button>
                    ) : (
                      <span className="ml-2 shrink-0 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {health.label}
                      </span>
                    )}
                  </div>
                );
              })}
            {Object.keys(distributorStatuses).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No distributors configured
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
