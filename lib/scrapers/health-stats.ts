import {
  HISTORY_MAX_AGE_MS,
  HISTORY_MAX_SAMPLES,
  sanitizeResponseTimeMs,
  type HealthHistory,
  type HealthSample,
  type HealthStatus,
} from "./health-types";

export function pruneHealthHistory(
  samples: HealthSample[],
  now = Date.now(),
): HealthSample[] {
  const cutoff = now - HISTORY_MAX_AGE_MS;
  const fresh = samples.filter((s) => new Date(s.at).getTime() >= cutoff);
  const sorted = [...fresh].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  return sorted.slice(-HISTORY_MAX_SAMPLES);
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
    // Guard the lookup: a corrupt sample with an unknown status would yield
    // `undefined`, making the sparkline's y-coordinate NaN (malformed SVG).
    const sparkline = samples
      .slice(-30)
      .map((s) => STATUS_VALUE[s.status] ?? 0);
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

export function computeHealthSummary(samples: HealthSample[]): HealthSummary {
  if (samples.length === 0) {
    return { count: 0, firstAt: null, lastAt: null, avgResponseTimeMs: null };
  }
  // Ignore unparseable dates: Math.min over NaN yields NaN, indexOf returns -1,
  // and samples[-1] throws (blanking the Health detail screen).
  const valid = samples.filter((s) => !Number.isNaN(new Date(s.at).getTime()));
  if (valid.length === 0) {
    return { count: samples.length, firstAt: null, lastAt: null, avgResponseTimeMs: null };
  }
  const times = valid.map((s) => new Date(s.at).getTime());
  const firstAt = valid[times.indexOf(Math.min(...times))].at;
  const lastAt = valid[times.indexOf(Math.max(...times))].at;
  const withResponse = samples.filter(
    (s) => sanitizeResponseTimeMs(s.responseTimeMs) !== undefined,
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
  reason?: string;
}

export function timelineSegments(samples: HealthSample[]): TimelineSegment[] {
  if (samples.length === 0) return [];
  const sorted = [...samples].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  if (sorted.length === 1)
    return [{ status: sorted[0].status, weight: 1, reason: sorted[0].reason }];
  const times = sorted.map((s) => new Date(s.at).getTime());
  const total = times[times.length - 1]! - times[0]!;
  // `total <= 0` is false for NaN (a corrupt sample with an invalid `at`), and
  // clamping NaN weights doesn't fix them — the timeline strip would collapse.
  // Treat a non-finite span as a flat distribution.
  if (!Number.isFinite(total) || total <= 0) {
    return sorted.map((s) => ({
      status: s.status,
      weight: 1 / sorted.length,
      reason: s.reason,
    }));
  }
  // Trapezoidal (nearest-neighbor) intervals: each sample owns half the gap
  // on either side, so weights always sum to 1. The old scheme reused the
  // last span for the final sample and overflowed (e.g. summed to 1.4).
  return sorted.map((s, i) => {
    const prev = i === 0 ? times[i]! : times[i - 1]!;
    const next = i === times.length - 1 ? times[i]! : times[i + 1]!;
    const weight = (next - prev) / 2 / total;
    return {
      status: s.status,
      weight: Math.min(Math.max(weight, 0), 1),
      reason: s.reason,
    };
  });
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
