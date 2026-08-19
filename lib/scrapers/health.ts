import type { ScrapeResult } from "./types";
import { PARSERS } from "./registry";
import { fetchWithParser } from "./utils";
import { classifyFetchStatus } from "./resilient";
import type { StorageAdapter } from "../storage";

export type HealthStatus = "working" | "blocked" | "error";

export interface DistributorHealth {
  distributorId: string;
  status: HealthStatus;
  reason?: string;
  responseTimeMs?: number;
  lastChecked: string;
}

export interface HealthSample {
  status: HealthStatus;
  reason?: string;
  responseTimeMs?: number;
  at: string;
}

export type HealthHistory = Record<string, HealthSample[]>;

const HEALTH_KEY = "distributor_health";
const HEALTH_HISTORY_KEY = "distributor_health_history";
const HISTORY_MAX_SAMPLES = 90;
const HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PROBE_MODEL = "CRS326";

export function classifyResult(
  html: string,
  result: ScrapeResult | null,
  error?: unknown,
): HealthStatus {
  if (error) return "error";
  if (classifyFetchStatus(html) === "blocked") return "blocked";
  if (result && result.price > 0) return "working";
  return "error";
}

export function pruneHealthHistory(
  samples: HealthSample[],
  now = Date.now(),
): HealthSample[] {
  const cutoff = now - HISTORY_MAX_AGE_MS;
  const fresh = samples.filter((s) => new Date(s.at).getTime() >= cutoff);
  return fresh.slice(-HISTORY_MAX_SAMPLES);
}

export function createHealthService(adapter: StorageAdapter) {
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
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  async function recordSample(
    distributorId: string,
    status: HealthStatus,
    reason?: string,
  ): Promise<void> {
    try {
      const history = await getHealthHistory();
      const samples = history[distributorId] ?? [];
      samples.push({ status, reason, at: new Date().toISOString() });
      history[distributorId] = pruneHealthHistory(samples);
      await adapter.setItem(HEALTH_HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Ignore history errors
    }
  }

  async function testAllDistributors(
    onProgress?: (current: number, total: number) => void,
  ): Promise<DistributorHealth[]> {
    const results: DistributorHealth[] = [];
    const CONCURRENCY = 3;
    const total = PARSERS.length;

    for (let i = 0; i < total; i += CONCURRENCY) {
      const batch = PARSERS.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (parser) => {
          const start = Date.now();
          try {
            const url = parser.buildSearchUrl(PROBE_MODEL);
            const html = await fetchWithParser(parser, url);
            const result = parser.parsePrice(html);
            const status = classifyResult(html, result);
            return {
              distributorId: parser.id,
              status,
              reason: status === "error" ? "no price found" : undefined,
              responseTimeMs: Date.now() - start,
              lastChecked: new Date().toISOString(),
            };
          } catch (error) {
            return {
              distributorId: parser.id,
              status: "error" as HealthStatus,
              reason: error instanceof Error ? error.message : String(error),
              responseTimeMs: Date.now() - start,
              lastChecked: new Date().toISOString(),
            };
          }
        }),
      );
      results.push(...batchResults);
      onProgress?.(Math.min(i + CONCURRENCY, total), total);
    }

    await saveDistributorHealth(results);
    return results;
  }

  return {
    getDistributorHealth,
    saveDistributorHealth,
    testAllDistributors,
    getHealthHistory,
    recordSample,
  };
}
