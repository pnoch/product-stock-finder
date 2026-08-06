import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { createHealthService, DistributorHealth, HealthStatus } from "../../../lib/scrapers/health";
import { getDistributorById } from "../../../lib/distributors";
import { storageAdapter } from "../storage";

const healthService = createHealthService(storageAdapter);

type Filter = "all" | "working" | "blocked" | "error";

export function Health() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<DistributorHealth[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);

  const loadHealth = useCallback(async () => {
    const data = await healthService.getDistributorHealth();
    setHealth(data);
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const runTest = useCallback(async () => {
    setTesting(true);
    setProgress(0);
    try {
      const results = await healthService.testAllDistributors((current, total) => {
        setProgress(Math.round((current / total) * 100));
      });
      setHealth(results);
    } finally {
      setTesting(false);
    }
  }, []);

  const counts = {
    working: health.filter((h) => h.status === "working").length,
    blocked: health.filter((h) => h.status === "blocked").length,
    error: health.filter((h) => h.status === "error").length,
  };

  const filtered = health.filter((h) => filter === "all" || h.status === filter);

  const statusColors: Record<HealthStatus, string> = {
    working: "#00C896",
    blocked: "#F59E0B",
    error: "#EF4444",
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        <button
          onClick={() => navigate("/settings")}
          className="text-blue-600 mr-3"
        >
          ‹ Back
        </button>
        <h1 className="text-2xl font-bold">Distributor Health</h1>
      </div>

      <div className="flex gap-2 mb-4">
        {(["all", "working", "blocked", "error"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-sm font-semibold border ${
              filter === f
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-800 border-gray-300"
            }`}
          >
            {f === "all" ? `All (${health.length})` : `${f} (${counts[f]})`}
          </button>
        ))}
      </div>

      <button
        onClick={runTest}
        disabled={testing}
        className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold mb-4 disabled:opacity-50"
      >
        {testing ? "Testing..." : "Test All Distributors"}
      </button>

      {testing && (
        <div className="mb-4">
          <div className="h-1.5 rounded bg-gray-200 overflow-hidden">
            <div
              className="h-1.5 bg-blue-600"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{progress}%</p>
        </div>
      )}

      <div>
        {filtered.map((h) => {
          const distributor = getDistributorById(h.distributorId);
          if (!distributor) return null;
          return (
            <div
              key={h.distributorId}
              className="flex items-center py-3 border-b border-gray-200"
            >
              <span
                className="w-2.5 h-2.5 rounded-full mr-3"
                style={{ backgroundColor: statusColors[h.status] }}
              />
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {distributor.countryFlag} {distributor.name}
                </p>
                <p className="text-xs text-gray-500">
                  {h.reason || h.status}
                  {h.responseTimeMs ? ` · ${h.responseTimeMs}ms` : ""}
                </p>
              </div>
              <span className="text-xs text-gray-400">
                {h.lastChecked
                  ? new Date(h.lastChecked).toLocaleTimeString()
                  : "Never"}
              </span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-gray-500 mt-10">
            No distributor health data. Tap "Test All Distributors" to run a check.
          </p>
        )}
      </div>
    </div>
  );
}
