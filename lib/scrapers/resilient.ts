export type FetchStatus = "ok" | "blocked" | "error" | "skipped";

export interface FetchOutcome {
  html?: string;
  status: FetchStatus;
  method: "plain" | "browser" | "none";
  error?: string;
}

export interface BreakerEntry {
  distributorId: string;
  status: "working" | "blocked" | "error";
  consecutiveFailures: number;
  lastAttemptAt: number;
  cooldownUntil: number;
  reason?: string;
}

export interface BreakerStateStore {
  get(distributorId: string): Promise<BreakerEntry | null>;
  set(entry: BreakerEntry): Promise<void>;
}

const BLOCKED_MARKERS = [
  "403 Forbidden",
  "Access Denied",
  "cf-browser-verification",
  "Checking your browser",
];

export function classifyFetchStatus(
  html: string,
  httpStatus?: number,
): "ok" | "blocked" | "error" {
  if (httpStatus === 403 || httpStatus === 429) return "blocked";
  if (httpStatus !== undefined && httpStatus >= 400) return "error";
  if (BLOCKED_MARKERS.some((marker) => html.includes(marker))) return "blocked";
  return "ok";
}

export function createMemoryBreakerStore(): BreakerStateStore {
  const entries = new Map<string, BreakerEntry>();
  return {
    async get(distributorId) {
      return entries.get(distributorId) ?? null;
    },
    async set(entry) {
      entries.set(entry.distributorId, entry);
    },
  };
}
