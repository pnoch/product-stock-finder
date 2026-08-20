import type { DistributorParser, ScrapeResult } from "./types";
import { PARSERS } from "./registry";
import {
  classifyFetchStatus,
  createStorageBreakerStore,
  resilientFetch,
} from "./resilient";
import type { FetchOutcome } from "./resilient";
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
const HISTORY_MAX_SAMPLES = 30 * 24;
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

export function classifyProbeOutcome(
  outcome: FetchOutcome,
  parser: DistributorParser,
): { status: HealthStatus; reason?: string } {
  if (outcome.status === "ok" && outcome.html) {
    const result = parser.parsePrice(outcome.html);
    const status = classifyResult(outcome.html, result);
    return { status, reason: status === "error" ? "no price found" : undefined };
  }
  if (outcome.status === "blocked") {
    return { status: "blocked", reason: outcome.error ?? "blocked by site" };
  }
  if (outcome.status === "skipped") {
    return { status: "blocked", reason: "in cooldown" };
  }
  return { status: "error", reason: outcome.error ?? "no price found" };
}

export function pruneHealthHistory(
  samples: HealthSample[],
  now = Date.now(),
): HealthSample[] {
  const cutoff = now - HISTORY_MAX_AGE_MS;
  const fresh = samples.filter((s) => new Date(s.at).getTime() >= cutoff);
  return fresh.slice(-HISTORY_MAX_SAMPLES);
}

export interface HealthStats {
  uptimePct: number;
  trend: "up" | "down" | "flat";
  sparkline: number[];
}

const STATUS_VALUE: Record<HealthStatus, number> = {
  working: 1,
  blocked: 0.5,
  error: 0,
};

export function computeHealthStats(
  history: HealthHistory,
): Record<string, HealthStats> {
  const stats: Record<string, HealthStats> = {};
  for (const [distributorId, samples] of Object.entries(history)) {
    if (samples.length === 0) continue;
    const working = samples.filter((s) => s.status === "working").length;
    const uptimePct = Math.round((working / samples.length) * 100);
    const half = Math.floor(samples.length / 2);
    let trend: "up" | "down" | "flat" = "flat";
    if (half > 0) {
      const recent = samples.slice(half);
      const earlier = samples.slice(0, half);
      const recentUptime =
        recent.filter((s) => s.status === "working").length / recent.length;
      const earlierUptime =
        earlier.filter((s) => s.status === "working").length / earlier.length;
      const diff = recentUptime - earlierUptime;
      if (diff >= 0.1) trend = "up";
      else if (diff <= -0.1) trend = "down";
    }
    const sparkline = samples.slice(-30).map((s) => STATUS_VALUE[s.status]);
    stats[distributorId] = { uptimePct, trend, sparkline };
  }
  return stats;
}

export interface HealthSummary {
  count: number;
  firstAt: string | null;
  lastAt: string | null;
  avgResponseTimeMs: number | null;
}

export function computeHealthSummary(
  samples: HealthSample[],
): HealthSummary {
  if (samples.length === 0) {
    return { count: 0, firstAt: null, lastAt: null, avgResponseTimeMs: null };
  }
  const times = samples.map((s) => new Date(s.at).getTime());
  const firstAt = samples[times.indexOf(Math.min(...times))].at;
  const lastAt = samples[times.indexOf(Math.max(...times))].at;
  const withResponse = samples.filter(
    (s) => typeof s.responseTimeMs === "number",
  );
  const avgResponseTimeMs =
    withResponse.length > 0
      ? Math.round(
          withResponse.reduce((sum, s) => sum + (s.responseTimeMs ?? 0), 0) /
            withResponse.length,
        )
      : null;
  return { count: samples.length, firstAt, lastAt, avgResponseTimeMs };
}

export interface TimelineSegment {
  status: HealthStatus;
  weight: number;
}

export function timelineSegments(samples: HealthSample[]): TimelineSegment[] {
  if (samples.length === 0) return [];
  const sorted = [...samples].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  if (sorted.length === 1) return [{ status: sorted[0].status, weight: 1 }];
  const spans: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    spans.push(
      new Date(sorted[i + 1].at).getTime() - new Date(sorted[i].at).getTime(),
    );
  }
  const total = spans.reduce((sum, s) => sum + s, 0);
  if (total <= 0) {
    return sorted.map((s) => ({ status: s.status, weight: 1 / sorted.length }));
  }
  spans.push(spans[spans.length - 1]);
  const totalWithLast = spans.reduce((sum, s) => sum + s, 0);
  return sorted.map((s, i) => ({
    status: s.status,
    weight: spans[i] / totalWithLast,
  }));
}

export interface DayGroup {
  day: string;
  samples: HealthSample[];
}

function localDayKey(at: string): string {
  const d = new Date(at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function groupSamplesByDay(samples: HealthSample[]): DayGroup[] {
  const groups = new Map<string, HealthSample[]>();
  for (const s of samples) {
    const day = localDayKey(s.at);
    const arr = groups.get(day) ?? [];
    arr.push(s);
    groups.set(day, arr);
  }
  return [...groups.entries()]
    .map(([day, groupSamples]) => ({
      day,
      samples: [...groupSamples].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      ),
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
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
    const breakerStore = createStorageBreakerStore(adapter);

    for (let i = 0; i < total; i += CONCURRENCY) {
      const batch = PARSERS.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (parser) => {
          const start = Date.now();
          try {
            const url = parser.buildSearchUrl(PROBE_MODEL);
            const outcome = await resilientFetch({
              parser,
              url,
              state: breakerStore,
            });
            const { status, reason } = classifyProbeOutcome(outcome, parser);
            return {
              distributorId: parser.id,
              status,
              reason,
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
    for (const r of results) {
      await recordSample(r.distributorId, r.status, r.reason);
    }
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
