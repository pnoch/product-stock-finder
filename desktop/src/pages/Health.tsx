import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { invoke } from "@tauri-apps/api/core";
import { getDistributorById } from "../../../lib/distributors";

type HealthStatus = "working" | "blocked" | "error";

interface DistributorHealth {
  distributorId: string;
  status: HealthStatus;
  reason?: string;
  responseTimeMs?: number;
  lastChecked: string;
}

type Filter = "all" | "working" | "blocked" | "error";

export function Health() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<DistributorHealth[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [testing, setTesting] = useState(false);

  const runTest = useCallback(async () => {
    setTesting(true);
    try {
      const results = await invoke<DistributorHealth[]>(
        "check_distributor_health",
      );
      setHealth(results);
    } catch (error) {
      console.error("Health check failed:", error);
    } finally {
      setTesting(false);
    }
  }, []);

  useEffect(() => {
    runTest();
  }, [runTest]);

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
