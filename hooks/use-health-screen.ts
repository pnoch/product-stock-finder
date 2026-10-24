import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { log } from "@shared/log";
import { showAlert } from "@/lib/alert";
import { useColors } from "@/hooks/use-colors";
import {
  computeHealthStats,
  createHealthService,
  type DistributorHealth,
  type HealthStats,
} from "@/lib/scrapers/health";
import { healthStatusColor } from "@/lib/health-status";
import { markUnlocked } from "@/lib/scrapers/session-store";

const healthService = createHealthService(AsyncStorage);

export type HealthFilter = "all" | "working" | "blocked" | "error";

export function useHealthScreen() {
  const colors = useColors();
  const [health, setHealth] = useState<DistributorHealth[]>([]);
  const [filter, setFilter] = useState<HealthFilter>("all");
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<Record<string, HealthStats>>({});
  const [assistParserId, setAssistParserId] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const resolveStatusColor = useCallback(
    (h: DistributorHealth) => healthStatusColor(h.status, h.reason, colors),
    [colors],
  );

  const loadHealth = useCallback(async () => {
    try {
      const data = await healthService.getDistributorHealth();
      setHealth(data);
      const history = await healthService.getHealthHistory();
      setStats(computeHealthStats(history));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth().catch(() => {});
  }, [loadHealth]);

  const runTest = useCallback(async () => {
    setTesting(true);
    setProgress(0);
    try {
      const results = await healthService.testAllDistributors(
        (current, total) => {
          if (isMountedRef.current)
            setProgress(Math.round((current / total) * 100));
        },
      );
      if (!isMountedRef.current) return;
      setHealth(results);
      const history = await healthService.getHealthHistory();
      if (!isMountedRef.current) return;
      setStats(computeHealthStats(history));
    } catch (e) {
      log.error("[Health] test all failed", e);
      if (isMountedRef.current) {
        showAlert(
          "Test failed",
          "Couldn't test distributors. Please try again.",
        );
      }
    } finally {
      if (isMountedRef.current) setTesting(false);
    }
  }, []);

  const handleAssistDone = useCallback(async () => {
    const parserId = assistParserId;
    setAssistParserId(null);
    if (!parserId) return;
    await markUnlocked(parserId);
    try {
      const result = await healthService.testDistributor(parserId);
      if (!isMountedRef.current || !result) return;
      setHealth((prev) => {
        const next = prev.filter((h) => h.distributorId !== parserId);
        next.push(result);
        return next;
      });
      const history = await healthService.getHealthHistory();
      if (isMountedRef.current) setStats(computeHealthStats(history));
    } catch (e) {
      log.error("[Health] re-probe after assist failed", e);
    }
  }, [assistParserId]);

  const counts = {
    working: health.filter((h) => h.status === "working").length,
    blocked: health.filter((h) => h.status === "blocked").length,
    error: health.filter((h) => h.status === "error").length,
  };

  const filtered = health.filter(
    (h) => filter === "all" || h.status === filter,
  );

  return {
    colors,
    health,
    filter,
    setFilter,
    loading,
    testing,
    progress,
    stats,
    assistParserId,
    setAssistParserId,
    resolveStatusColor,
    loadHealth,
    runTest,
    handleAssistDone,
    counts,
    filtered,
  };
}
