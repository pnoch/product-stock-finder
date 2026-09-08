import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { getDistributorById } from "@shared/distributors";
import {
  computeHealthStats,
  computeHealthSummary,
  createHealthService,
  groupSamplesByDay,
  type HealthSample,
  type HealthStatus,
  timelineSegments,
} from "../../../lib/scrapers/health";

const localAdapter = {
  getItem: async (k: string) => localStorage.getItem(k),
  setItem: async (k: string, v: string) => localStorage.setItem(k, v),
  removeItem: async (k: string) => localStorage.removeItem(k),
  multiRemove: async (keys: string[]) => keys.forEach((k) => localStorage.removeItem(k)),
};

const healthService = createHealthService(localAdapter as unknown as import("../../../lib/storage/adapter").StorageAdapter);

export function HealthDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [samples, setSamples] = useState<HealthSample[]>([]);
  const [currentStatus, setCurrentStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const distributor = id ? getDistributorById(id) : undefined;

  const statusColors: Record<HealthStatus, string> = {
    working: "#00C896",
    blocked: "#F59E0B",
    error: "#EF4444",
  };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const history = await healthService.getHealthHistory();
      setSamples(history[id] ?? []);
      const health = await healthService.getDistributorHealth();
      const entry = health.find((h) => h.distributorId === id);
      setCurrentStatus((entry?.status as HealthStatus) ?? null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load health history");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!distributor) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-blue-600 mb-4" aria-label="Go back">‹ Back</button>
        <p className="text-center text-gray-500 mt-10">Distributor not found</p>
      </div>
    );
  }

  const stats = computeHealthStats(samples.length > 0 ? { [id!]: samples } : {})[id!];
  const summary = computeHealthSummary(samples);
  const segments = timelineSegments(samples);
  const groups = groupSamplesByDay(samples);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        <button onClick={() => navigate(-1)} className="text-blue-600 mr-3" aria-label="Go back">‹ Back</button>
        <h1 className="text-xl font-bold">{distributor.countryFlag} {distributor.name}</h1>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 mb-6 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <span className="flex-1">Couldn't load health history: {loadError}</span>
          <button
            onClick={() => void load()}
            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
            aria-label="Retry loading health history"
          >
            Retry
          </button>
        </div>
      )}
      {loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6" role="status">Loading health history…</p>
      )}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentStatus ? statusColors[currentStatus] : "#9ca3af" }} title={currentStatus ?? "No data"} />
          <span className="text-sm font-semibold">{currentStatus ?? "No data"}</span>
        </div>
        {stats ? (
          <>
            <p className="text-3xl font-bold">{stats.uptimePct}% <span className="text-lg">{stats.trend === "up" ? "▲" : stats.trend === "down" ? "▼" : "–"}</span></p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{summary.count} samples · first {summary.firstAt ? new Date(summary.firstAt).toLocaleDateString() : "–"} · last {summary.lastAt ? new Date(summary.lastAt).toLocaleDateString() : "–"}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">avg response {summary.avgResponseTimeMs != null ? `${summary.avgResponseTimeMs}ms` : "–"}</p>
          </>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No health history yet. Run Test All or wait for scheduled probes.</p>
        )}
        {segments.length > 0 && (
          <div className="flex h-2 rounded-full overflow-hidden mt-4" role="img" aria-label={`Health timeline: ${segments.map((seg) => `${seg.status}`).join(", ")}`}>
            {segments.map((seg, i) => (
              <div key={i} style={{ flex: seg.weight, backgroundColor: statusColors[seg.status] }} title={seg.status} />
            ))}
          </div>
        )}
      </div>

      {groups.map((g) => {
        const working = g.samples.filter((s) => s.status === "working").length;
        const pct = Math.round((working / g.samples.length) * 100);
        return (
          <div key={g.day} className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              {new Date(g.day + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {g.samples.length} samples · {pct}% working
            </h3>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {g.samples.map((s, i) => (
                <div key={`${s.at}-${i}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: statusColors[s.status] }} title={`${s.status} · ${new Date(s.at).toLocaleString()}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{new Date(s.at).toLocaleString()}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.reason || s.status}{s.responseTimeMs ? ` · ${s.responseTimeMs}ms` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {groups.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-8">No health history yet. Run Test All or wait for scheduled probes.</p>
      )}
    </div>
  );
}
