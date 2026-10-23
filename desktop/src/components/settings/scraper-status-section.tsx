import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { getDistributorById } from "@shared/distributors";
import { getAllParserIds } from "../../../../lib/scrapers/registry";
import { clearDistributorBreaker } from "../../../../lib/scrapers/breaker-clear";
import {
  createStorageBreakerStore,
  type BreakerEntry,
} from "../../../../lib/scrapers/breaker-store";
import { localStorageAdapter } from "../../lib/local-storage-adapter";
import type { Product } from "../../../../lib/types";
import { storage } from "../../storage";

type DistributorStatus = {
  lastAttempt: string | null;
  breaker: BreakerEntry | null;
};

// The real health dashboard reads the circuit breaker, not listing timestamps:
// `lastChecked` is stamped on failures too, so a timestamp heuristic showed
// "OK" for a distributor that had been blocked for days.
function getDistributorHealth(
  breaker: BreakerEntry | null,
): { label: string; dot: string } {
  if (!breaker) {
    return { label: "Never Checked", dot: "bg-gray-400" };
  }
  if (breaker.status === "working") {
    return { label: "OK", dot: "bg-emerald-500" };
  }
  if (breaker.status === "blocked") {
    return { label: "Blocked", dot: "bg-amber-500" };
  }
  return { label: "Failing", dot: "bg-red-500" };
}

export function ScraperStatusSection({
  showToast,
}: {
  showToast: (message: string) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [breakers, setBreakers] = useState<Record<string, BreakerEntry>>({});
  const [productsLoading, setProductsLoading] = useState(true);
  const [reenabling, setReenabling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const store = createStorageBreakerStore(localStorageAdapter);
    Promise.all([
      storage.getWatchlist().catch(() => [] as Product[]),
      Promise.all(
        getAllParserIds().map(async (id) => [id, await store.get(id)] as const),
      ),
    ])
      .then(([watchlist, entries]) => {
        if (cancelled) return;
        setProducts(watchlist);
        const map: Record<string, BreakerEntry> = {};
        for (const [id, entry] of entries) {
          if (entry) map[id] = entry;
        }
        setBreakers(map);
      })
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
      statuses[id] = { lastAttempt: null, breaker: null };
    }
    for (const [id, breaker] of Object.entries(breakers)) {
      statuses[id] = {
        lastAttempt:
          breaker.lastAttemptAt > 0
            ? new Date(breaker.lastAttemptAt).toISOString()
            : null,
        breaker,
      };
    }
    // Keep the watchlist read so the section still reflects tracked products;
    // the breaker is the source of truth for health.
    void products;
    return statuses;
  }, [products, breakers]);

  const handleReenableDistributor = useCallback(
    async (distributorId: string) => {
      if (reenabling) return;
      setReenabling(true);
      try {
        // Only clear the circuit breaker so the next price check attempts the
        // fetch again. Do NOT stamp lastChecked: that field means "last
        // successful check", so stamping it made a failed distributor show
        // "OK / Last checked: today" with no prices actually fetched.
        await clearDistributorBreaker(distributorId, localStorageAdapter).catch(
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
                const health = getDistributorHealth(status.breaker);
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
                        {status.lastAttempt
                          ? `Last attempt: ${new Date(status.lastAttempt).toLocaleDateString()}`
                          : "Never checked"}
                        {status.breaker?.reason ? ` · ${status.breaker.reason}` : ""}
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
