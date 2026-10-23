import type { DistributorParser, ScrapeResult } from "./types";
import { classifyFetchStatus } from "./resilient";
import type { FetchOutcome } from "./resilient";

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

export const HEALTH_KEY = "distributor_health";
export const HEALTH_HISTORY_KEY = "distributor_health_history";
export const HISTORY_MAX_SAMPLES = 30 * 24;
export const HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PROBE_MODEL = "CRS326";

// A probe's response time is wall-clock around the fetch. On Android the JS
// event loop freezes while the app is backgrounded (see
// lib/background-safe-timers.ts), so a scheduled probe that spans a suspension
// records the suspension duration — minutes, not milliseconds — and poisons
// the average. Anything above this bound is not network latency; drop it.
export const MAX_RESPONSE_TIME_MS = 60_000;

export function sanitizeResponseTimeMs(
  ms: number | undefined,
): number | undefined {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return undefined;
  if (ms > MAX_RESPONSE_TIME_MS) return undefined;
  return ms;
}

const PROBE_MODEL_BY_DISTRIBUTOR: Record<string, string> = {
  "server2u-my": "CRS804-4DDQ-hRM",
  "linitx-uk": "CRS326-24S+2Q+RM",
  "interprojekt-pl": "CRS804-4DDQ-hRM",
  "nasstore-eu": "CRS326-24S+2Q+RM",
  "aerial-gr": "CRS804-4DDQ-hRM",
  "mikrotikstore-de": "CRS326-24S+2Q+RM",
  "miro-za": "CRS804-4DDQ-hRM",
  "gearup-ae": "CRS326-24S+2Q+RM",
  "balticnetworks-us": "CRS326-24S+2Q+RM",
  "linktechs-us": "CRS804-4DDQ-hRM",
  "winncom-us": "CRS326-24S+2Q+RM",
  "bhphoto-us": "CRS804-4DDQ-hRM",
  "duxtel-au": "CRS326-24S+2Q+RM",
  "wisp-au": "CRS804-4DDQ-hRM",
  "pbtech-nz": "CRS326-24S+2Q+RM",
  "gowifi-nz": "CRS804-4DDQ-hRM",
  "getic-gr": "CRS326-24S+2Q+RM",
  "100mega-cz": "CRS804-4DDQ-hRM",
  "hellascom-gr": "CRS326-24S+2Q+RM",
  "rocnoc-us": "CRS804-4DDQ-hRM",
  "networkdevices-us": "CRS326-24S+2Q+RM",
  "flytec-us": "CRS804-4DDQ-hRM",
  "mbsiwav-ca": "CRS326-24S+2Q+RM",
  "multilink-us": "CRS804-4DDQ-hRM",
  "neobits-us": "CRS326-24S+2Q+RM",
};

export function getProbeModel(distributorId: string): string {
  return PROBE_MODEL_BY_DISTRIBUTOR[distributorId] ?? PROBE_MODEL;
}

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
    const model = getProbeModel(parser.id);
    const url = parser.buildSearchUrl(model);
    const result = parser.parsePrice(outcome.html, model, url);
    const status = classifyResult(outcome.html, result);
    return { status, reason: status === "error" ? "no price found" : undefined };
  }
  if (outcome.status === "blocked") {
    return { status: "blocked", reason: outcome.error ?? "blocked by site" };
  }
  if (outcome.status === "skipped") {
    // A cooldown is a transient circuit-breaker state, not a failure: reporting
    // it as "error" made a distributor cooling down after one block accumulate
    // false error samples and trip the health alert.
    return { status: "blocked", reason: "in cooldown" };
  }
  return { status: "error", reason: outcome.error ?? "no price found" };
}
