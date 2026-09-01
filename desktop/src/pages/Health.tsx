import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { invoke } from "@tauri-apps/api/core";
import { getDistributorById } from "../../../lib/distributors";
import { computeHealthStats, createHealthService, type HealthStats } from "../../../lib/scrapers/health";
import { formatLastRefreshed } from "../../../lib/last-refreshed";

type HealthStatus = "working" | "blocked" | "error";

interface DistributorHealth {
  distributorId: string;
  status: HealthStatus;
  reason?: string;
  responseTimeMs?: number;
  lastChecked: string;
}

type Filter = "all" | "working" | "blocked" | "error";

function HealthSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const w = 60;
  const h = 24;
  const pad = 2;
  const usableW = w - pad * 2;
  const usableH = h - pad * 2;
  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * usableW;
      const y = pad + (1 - v) * usableH;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const localAdapter = {
  getItem: async (k: string) => localStorage.getItem(k),
  setItem: async (k: string, v: string) => localStorage.setItem(k, v),
  removeItem: async (k: string) => localStorage.removeItem(k),
  multiRemove: async (keys: string[]) => keys.forEach((k) => localStorage.removeItem(k)),
};

export function Health() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<DistributorHealth[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<Record<string, HealthStats>>({});

  const runTest = useCallback(async () => {
    setTesting(true);
    setProgress(0);
    try {
      const results = await invoke<DistributorHealth[]>(
        "check_distributor_health",
      );
      setHealth(results);
      setProgress(100);
      try {
        const svc = createHealthService(localAdapter as unknown as import("../../../lib/storage/adapter").StorageAdapter);
        await svc.saveDistributorHealth(results as unknown as import("../../../lib/scrapers/health").DistributorHealth[]);
        for (const r of results) {
          await svc.recordSample(r.distributorId, r.status, r.reason, r.responseTimeMs);
        }
        const history = await svc.getHealthHistory();
        setStats(computeHealthStats(history));
      } catch {
        // stats are best-effort
      }
    } catch (error) {
      console.error("Health check failed:", error);
    } finally {
      setTesting(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const svc = createHealthService(localAdapter as unknown as import("../../../lib/storage/adapter").StorageAdapter);
        const history = await svc.getHealthHistory();
        setStats(computeHealthStats(history));
        const existing = await svc.getDistributorHealth();
        if (existing.length > 0) setHealth(existing as DistributorHealth[]);
      } catch {
        // ignore
      }
    })();
  }, []);

  const counts = {
    working: health.filter((h) => h.status === "working").length,
    blocked: health.filter((h) => h.status === "blocked").length,
    error: health.filter((h) => h.status === "error").length,
  };

  const filtered = health.filter(
    (h) => filter === "all" || h.status === filter,
  );

  const statusColors: Record<HealthStatus, string> = {
    working: "#00C896",
    blocked: "#F59E0B",
    error: "#EF4444",
  };

  const overallWorkingPct = health.length > 0 ? Math.round((counts.working / health.length) * 100) : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        <button
          onClick={() => navigate("/settings")}
          className="text-blue-600 mr-3"
          aria-label="Go back to settings"
        >
          ‹ Back
        </button>
        <h1 className="text-2xl font-bold">Distributor Health</h1>
      </div>

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
        {(["all", "working", "blocked", "error"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
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
        onClick={runTest}
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

      <div>
        {filtered.map((h) => {
          const distributor = getDistributorById(h.distributorId);
          const s = stats[h.distributorId];
          return (
            <button
              key={h.distributorId}
              onClick={() => navigate(`/health/${h.distributorId}`)}
              className="w-full flex items-center py-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left transition-colors"
              aria-label={`View ${distributor?.name ?? h.distributorId} details`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full mr-3 shrink-0"
                style={{ backgroundColor: statusColors[h.status] }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  {distributor
                    ? `${distributor.countryFlag} ${distributor.name}`
                    : h.distributorId}
                </p>
                <p className="text-xs text-gray-500">
                  {h.reason || h.status}
                  {h.responseTimeMs ? ` · ${h.responseTimeMs}ms` : ""}
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
                    <span className="text-xs font-bold" style={{ color: statusColors[h.status] }}>
                      {s.uptimePct}% {s.trend === "up" ? "▲" : s.trend === "down" ? "▼" : "–"}
                    </span>
                    <HealthSparkline data={s.sparkline} color={statusColors[h.status]} />
                  </>
                ) : (
                  <span className="text-xs text-gray-400">–</span>
                )}
              </div>
              <span className="ml-2 text-gray-300 dark:text-gray-600">›</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-gray-500 mt-10">
            No distributor health data. Tap "Test All Distributors" to run a
            check.
          </p>
        )}
      </div>
    </div>
  );
}
