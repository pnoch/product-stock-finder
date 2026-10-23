import { PARSERS } from "./registry";
import { createStorageBreakerStore, fetchAndParse } from "./resilient";
import type { StorageAdapter } from "../storage";
import {
  HEALTH_HISTORY_KEY,
  HEALTH_KEY,
  classifyProbeOutcome,
  getProbeModel,
  sanitizeResponseTimeMs,
  type DistributorHealth,
  type HealthHistory,
  type HealthSample,
  type HealthStatus,
} from "./health-types";
import { pruneHealthHistory } from "./health-stats";

export type HealthService = {
  getDistributorHealth(): Promise<DistributorHealth[]>;
  saveDistributorHealth(health: DistributorHealth[]): Promise<void>;
  testAllDistributors(
    onProgress?: (current: number, total: number) => void,
  ): Promise<DistributorHealth[]>;
  testDistributor(parserId: string): Promise<DistributorHealth | null>;
  getHealthHistory(): Promise<HealthHistory>;
  recordSample(
    distributorId: string,
    status: HealthStatus,
    reason?: string,
    responseTimeMs?: number,
  ): Promise<void>;
};

// The background probe task and the manual "Test All" button each build their
// own service instance, so this single-flight promise must live at module scope
// or the two runs overlap and double the requests (25 parsers → 50). A joining
// caller drops its own onProgress, which is correct — the running pass reports
// its own progress.
let inFlightProbe: Promise<DistributorHealth[]> | null = null;

export function createHealthService(adapter: StorageAdapter): HealthService {
  async function getDistributorHealth(): Promise<DistributorHealth[]> {
    try {
      const raw = await adapter.getItem(HEALTH_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function saveDistributorHealth(
    health: DistributorHealth[],
  ): Promise<void> {
    try {
      await adapter.setItem(HEALTH_KEY, JSON.stringify(health));
    } catch {
      // Ignore save errors
    }
  }

  async function getHealthHistory(): Promise<HealthHistory> {
    try {
      const raw = await adapter.getItem(HEALTH_HISTORY_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const history: HealthHistory = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          // Sort by parsed time: `detectHealthAlert`/`detectHealthRecovery` and
          // the timeline read positionally (`slice(-threshold)`), so an
          // unsorted store (a hand-edited/legacy payload) would misread the
          // newest samples.
          history[key] = [...(value as HealthSample[])].sort(
            (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
          );
        }
      }
      return history;
    } catch {
      return {};
    }
  }

  async function recordSample(
    distributorId: string,
    status: HealthStatus,
    reason?: string,
    responseTimeMs?: number,
  ): Promise<void> {
    try {
      const history = await getHealthHistory();
      const samples = history[distributorId] ?? [];
      samples.push({
        status,
        reason,
        responseTimeMs,
        at: new Date().toISOString(),
      });
      history[distributorId] = pruneHealthHistory(samples);
      await adapter.setItem(HEALTH_HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Ignore history errors
    }
  }

  async function testAllDistributors(
    onProgress?: (current: number, total: number) => void,
  ): Promise<DistributorHealth[]> {
    if (inFlightProbe) return inFlightProbe;
    const run = testAllDistributorsInner(onProgress).finally(() => {
      inFlightProbe = null;
    });
    inFlightProbe = run;
    return run;
  }

  async function probeParser(
    parser: (typeof PARSERS)[number],
    breakerStore: ReturnType<typeof createStorageBreakerStore>,
  ): Promise<DistributorHealth> {
    const start = Date.now();
    try {
      const model = getProbeModel(parser.id);
      const { outcome } = await fetchAndParse(parser, model, breakerStore);
      const { status, reason } = classifyProbeOutcome(outcome, parser);
      return {
        distributorId: parser.id,
        status,
        reason,
        responseTimeMs: sanitizeResponseTimeMs(Date.now() - start),
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        distributorId: parser.id,
        status: "error" as HealthStatus,
        reason: error instanceof Error ? error.message : String(error),
        responseTimeMs: sanitizeResponseTimeMs(Date.now() - start),
        lastChecked: new Date().toISOString(),
      };
    }
  }

  async function testDistributor(
    parserId: string,
  ): Promise<DistributorHealth | null> {
    const parser = PARSERS.find((p) => p.id === parserId);
    if (!parser) return null;
    const breakerStore = createStorageBreakerStore(adapter);
    const result = await probeParser(parser, breakerStore);
    const current = await getDistributorHealth();
    const merged = current.filter((h) => h.distributorId !== parserId);
    merged.push(result);
    await saveDistributorHealth(merged);
    await recordSample(
      result.distributorId,
      result.status,
      result.reason,
      result.responseTimeMs,
    );
    return result;
  }

  async function testAllDistributorsInner(
    onProgress?: (current: number, total: number) => void,
  ): Promise<DistributorHealth[]> {
    const results: DistributorHealth[] = [];
    const CONCURRENCY = 3;
    const total = PARSERS.length;
    const breakerStore = createStorageBreakerStore(adapter);

    for (let i = 0; i < total; i += CONCURRENCY) {
      const batch = PARSERS.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((parser) => probeParser(parser, breakerStore)),
      );
      results.push(...batchResults);
      onProgress?.(Math.min(i + CONCURRENCY, total), total);
    }

    await saveDistributorHealth(results);
    for (const r of results) {
      await recordSample(r.distributorId, r.status, r.reason, r.responseTimeMs);
    }
    return results;
  }

  return {
    getDistributorHealth,
    saveDistributorHealth,
    testAllDistributors,
    testDistributor,
    getHealthHistory,
    recordSample,
  };
}
