import { formatLastRefreshed } from "../../../../lib/last-refreshed";
import type { DistributorHealth } from "../../../../lib/scrapers/health";
import type { HealthFilter } from "../../hooks/use-health-data";

export function HealthSummary({
  health,
  counts,
  overallWorkingPct,
  filter,
  onFilterChange,
  testing,
  progress,
  healthError,
  onRunTest,
}: {
  health: DistributorHealth[];
  counts: { working: number; blocked: number; error: number };
  overallWorkingPct: number;
  filter: HealthFilter;
  onFilterChange: (filter: HealthFilter) => void;
  testing: boolean;
  progress: number;
  healthError: string | null;
  onRunTest: () => void;
}) {
  return (
    <>
      {healthError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 mb-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <span className="flex-1">{healthError}</span>
          <button
            onClick={onRunTest}
            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
            aria-label="Retry health check"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Overall Uptime</p>
          <p className="text-2xl font-bold mt-1">{overallWorkingPct}% <span className="text-sm font-medium text-gray-500">{counts.working}/{health.length} working</span></p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{counts.blocked} blocked · {counts.error} error</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Last check</p>
          <p className="text-sm font-medium">{(() => { if (health.length === 0) return "Never"; const latest = health.reduce((max, h) => Math.max(max, new Date(h.lastChecked).getTime()), 0); return Number.isFinite(latest) && latest > 0 ? formatLastRefreshed(new Date(latest).toISOString()) : "Never"; })()}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {(["all", "working", "blocked", "error"] as HealthFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`px-3 py-1 rounded-full text-sm font-semibold border ${
              filter === f
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600"
            }`}
            aria-label={`Filter by ${f === "all" ? "all statuses" : f}`}
          >
            {f === "all" ? `All (${health.length})` : `${f} (${counts[f]})`}
          </button>
        ))}
      </div>

      <button
        onClick={onRunTest}
        disabled={testing}
        className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold mb-4 disabled:opacity-50"
        aria-label="Test all distributors"
      >
        {testing ? "Testing..." : "Test All Distributors"}
      </button>

      {testing && (
        <div className="mb-4">
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            {progress > 0 && progress < 100 ? (
              <div className="h-1.5 bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
            ) : (
              <div className="h-1.5 w-1/3 bg-blue-600 rounded-full animate-pulse" />
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{progress ? `${progress}%` : "Running checks..."}</p>
        </div>
      )}
    </>
  );
}
