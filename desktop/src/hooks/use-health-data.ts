import { useCallback, useEffect, useRef, useState } from "react";
import { log } from "@shared/log";
import { classifyFetchStatus } from "../../../lib/scrapers/resilient";
import { createTRPCClient } from "../lib/trpc";
import { invoke } from "@tauri-apps/api/core";
import { computeHealthStats, createHealthService, type DistributorHealth, type HealthStats } from "../../../lib/scrapers/health";
import { localAdapter } from "../lib/health-adapter";
type HealthStatus = "working" | "blocked" | "error";

export type HealthFilter = "all" | "working" | "blocked" | "error";

export function useHealthData() {
  const [health, setHealth] = useState<DistributorHealth[]>([]);
  const [filter, setFilter] = useState<HealthFilter>("all");
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, HealthStats>>({});
  const testingRef = useRef(false);

  const runTest = useCallback(async () => {
    if (testingRef.current) return;
    testingRef.current = true;
    setTesting(true);
    setProgress(0);
    setHealthError(null);
    let unlisten: (() => void) | null = null;
    try {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<{ progress: number }>("health-check-progress", (event) => {
          const p = event.payload.progress;
          if (typeof p === "number" && Number.isFinite(p)) setProgress(Math.min(100, Math.max(0, p)));
        });
      } catch {
        // listen unavailable (e.g. web preview)
      }
      let results: DistributorHealth[];
      try {
        results = await invoke<DistributorHealth[]>("check_distributor_health");
      } catch {
        log.error("[Health] Tauri check unavailable, falling back to server");
        const client = createTRPCClient();
        results = await client.health.check.query();
      }
      setHealth(results);
      setProgress(100);
      try {
        const svc = createHealthService(localAdapter);
        await svc.saveDistributorHealth(results);
        for (const r of results) {
          await svc.recordSample(r.distributorId, r.status, r.reason, r.responseTimeMs);
        }
        const history = await svc.getHealthHistory();
        setStats(computeHealthStats(history));
      } catch {
        // stats are best-effort
      }
    } catch (error) {
      log.error("Health check failed:", error);
      setHealthError(error instanceof Error ? error.message : "Health check failed");
    } finally {
      if (unlisten) unlisten();
      testingRef.current = false;
      setTesting(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const svc = createHealthService(localAdapter);
        const history = await svc.getHealthHistory();
        setStats(computeHealthStats(history));
        const existing = await svc.getDistributorHealth();
        if (existing.length > 0) setHealth(existing);
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

  const resolveStatusColor = (h: DistributorHealth): string => {
    if (h.status === "blocked") return statusColors.blocked;
    if (h.reason && classifyFetchStatus(h.reason) === "blocked") return statusColors.blocked;
    return statusColors[h.status];
  };

  const overallWorkingPct = health.length > 0 ? Math.round((counts.working / health.length) * 100) : 0;

  return {
    health,
    stats,
    testing,
    progress,
    healthError,
    filter,
    setFilter,
    counts,
    filtered,
    resolveStatusColor,
    overallWorkingPct,
    runTest,
  };
}
