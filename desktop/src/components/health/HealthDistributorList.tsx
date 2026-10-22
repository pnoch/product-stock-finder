import { getDistributorById } from "@shared/distributors";
import { formatLastRefreshed } from "../../../../lib/last-refreshed";
import { sanitizeResponseTimeMs } from "../../../../lib/scrapers/health";
import type { DistributorHealth, HealthStats } from "../../../../lib/scrapers/health";
import { HealthSparkline } from "./HealthSparkline";

export function HealthDistributorList({
  health,
  filtered,
  stats,
  resolveStatusColor,
  onOpen,
  onRunTest,
  onShowAll,
}: {
  health: DistributorHealth[];
  filtered: DistributorHealth[];
  stats: Record<string, HealthStats>;
  resolveStatusColor: (h: DistributorHealth) => string;
  onOpen: (distributorId: string) => void;
  onRunTest: () => void;
  onShowAll: () => void;
}) {
  return (
    <div>
      {filtered.map((h) => {
        const distributor = getDistributorById(h.distributorId);
        const s = stats[h.distributorId];
        return (
          <button
            key={h.distributorId}
            onClick={() => onOpen(h.distributorId)}
            className="w-full flex items-center py-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left transition-colors"
            aria-label={`View ${distributor?.name ?? h.distributorId} details`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full mr-3 shrink-0"
              style={{ backgroundColor: resolveStatusColor(h) }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                {distributor
                  ? `${distributor.countryCode} ${distributor.name}`
                  : h.distributorId}
              </p>
              <p className="text-xs text-gray-500">
                {h.reason || h.status}
                {sanitizeResponseTimeMs(h.responseTimeMs) != null
                  ? ` · ${sanitizeResponseTimeMs(h.responseTimeMs)}ms`
                  : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 ml-3 shrink-0">
              <span className="text-xs text-gray-400">
                {h.lastChecked
                  ? formatLastRefreshed(h.lastChecked)
                  : "Never"}
              </span>
              {s ? (
                <>
                  <span className="text-xs font-bold" style={{ color: resolveStatusColor(h) }}>
                    {s.uptimePct}% {s.trend === "up" ? "▲" : s.trend === "down" ? "▼" : "–"}
                  </span>
                  <HealthSparkline data={s.sparkline} color={resolveStatusColor(h)} />
                </>
              ) : (
                <span className="text-xs text-gray-400">–</span>
              )}
            </div>
            <span className="ml-2 text-gray-300 dark:text-gray-600">›</span>
          </button>
        );
      })}
      {health.length === 0 ? (
        <div className="text-center mt-10">
          <p className="font-semibold text-gray-700 dark:text-gray-200">
            No distributor health data
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Click &quot;Test All Distributors&quot; to run a check.
          </p>
          <button
            onClick={onRunTest}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
            aria-label="Test All Distributors"
          >
            Test All Distributors
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center mt-10">
          <p className="font-semibold text-gray-700 dark:text-gray-200">No matches</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            No distributors match the selected filter.
          </p>
          <button
            onClick={onShowAll}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Show all distributors"
          >
            Show All
          </button>
        </div>
      ) : null}
    </div>
  );
}
