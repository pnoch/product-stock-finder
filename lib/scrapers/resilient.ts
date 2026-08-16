import type { StorageAdapter } from "../storage";
import { getRandomUserAgent } from "./utils";
import type { DistributorParser } from "./types";

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

export function createStorageBreakerStore(
  adapter: Pick<StorageAdapter, "getItem" | "setItem">,
): BreakerStateStore {
  const KEY = "distributor_breaker";

  async function readList(): Promise<BreakerEntry[]> {
    try {
      const raw = await adapter.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as BreakerEntry[]) : [];
    } catch {
      return [];
    }
  }

  return {
    async get(distributorId) {
      const list = await readList();
      return list.find((e) => e.distributorId === distributorId) ?? null;
    },
    async set(entry) {
      try {
        const list = await readList();
        const next = list.filter((e) => e.distributorId !== entry.distributorId);
        next.push(entry);
        await adapter.setItem(KEY, JSON.stringify(next));
      } catch {
        // Ignore persistence errors
      }
    },
  };
}

export interface ResilientFetchOptions {
  parser: DistributorParser;
  url: string;
  state: BreakerStateStore;
  now?: () => number;
  maxRetries?: number;
  retryBaseMs?: number;
  blockedCooldownMs?: number;
  failureCooldownMs?: number;
  failureThreshold?: number;
  maxCooldownMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPlain(
  url: string,
  rateLimitMs: number,
): Promise<{ html: string; status: number }> {
  await sleep(rateLimitMs);
  const response = await fetch(url, {
    headers: {
      "User-Agent": getRandomUserAgent(),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate",
    },
  });
  const html = await response.text();
  return { html, status: response.status };
}

async function fetchBrowser(
  parser: DistributorParser,
  url: string,
): Promise<string> {
  const { fetchWithBrowser } = await import("./browser");
  return fetchWithBrowser(url, parser.browserOptions);
}

function blockCooldownMs(
  baseMs: number,
  consecutiveFailures: number,
  maxMs: number,
): number {
  const growth = Math.pow(1.5, consecutiveFailures - 1);
  return Math.min(Math.round(baseMs * growth), maxMs);
}

async function recordSuccess(
  state: BreakerStateStore,
  distributorId: string,
  now: number,
): Promise<void> {
  await state.set({
    distributorId,
    status: "working",
    consecutiveFailures: 0,
    lastAttemptAt: now,
    cooldownUntil: 0,
  });
}

async function attemptMethod(
  method: "plain" | "browser",
  opts: ResilientFetchOptions,
  maxRetries: number,
  retryBaseMs: number,
): Promise<FetchOutcome> {
  let last: FetchOutcome = {
    status: "error",
    method,
    error: "no attempt made",
  };
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleep(retryBaseMs * attempt);
    try {
      if (method === "browser") {
        const html = await fetchBrowser(opts.parser, opts.url);
        const status = classifyFetchStatus(html);
        if (status === "ok") return { html, status: "ok", method };
        last = { status, method, error: "blocked by site" };
        break;
      }
      const { html, status: httpStatus } = await fetchPlain(
        opts.url,
        opts.parser.rateLimitMs,
      );
      const status = classifyFetchStatus(html, httpStatus);
      if (status === "ok") return { html, status: "ok", method };
      last = {
        status,
        method,
        error: status === "blocked" ? "blocked by site" : `HTTP ${httpStatus}`,
      };
      if (status === "blocked") break;
    } catch (error) {
      last = {
        status: "error",
        method,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return last;
}

export async function resilientFetch(
  opts: ResilientFetchOptions,
): Promise<FetchOutcome> {
  const now = opts.now ?? Date.now;
  const maxRetries = opts.maxRetries ?? 2;
  const retryBaseMs = opts.retryBaseMs ?? 1000;
  const blockedCooldownMs = opts.blockedCooldownMs ?? 30 * 60 * 1000;
  const failureCooldownMs = opts.failureCooldownMs ?? 15 * 60 * 1000;
  const failureThreshold = opts.failureThreshold ?? 3;
  const maxCooldownMs = opts.maxCooldownMs ?? 2 * 60 * 60 * 1000;

  const entry = (await opts.state.get(opts.parser.id)) ?? {
    distributorId: opts.parser.id,
    status: "working" as const,
    consecutiveFailures: 0,
    lastAttemptAt: 0,
    cooldownUntil: 0,
  };

  if (entry.cooldownUntil > now()) {
    return { status: "skipped", method: "none" };
  }

  const methods: Array<"plain" | "browser"> =
    opts.parser.useBrowser === true
      ? ["browser", "plain"]
      : ["plain", "browser"];

  let lastOutcome: FetchOutcome = {
    status: "error",
    method: "none",
    error: "no attempt made",
  };
  let blockedOutcome: FetchOutcome | null = null;

  for (const method of methods) {
    const outcome = await attemptMethod(method, opts, maxRetries, retryBaseMs);
    if (outcome.status === "blocked" && !blockedOutcome) blockedOutcome = outcome;
    lastOutcome = outcome;
    if (outcome.status === "ok") {
      await recordSuccess(opts.state, opts.parser.id, now());
      return outcome;
    }
    if (outcome.status === "blocked") {
      if (method === "plain") continue;
      break;
    }
    if (method === "browser") continue;
    break;
  }

  if (blockedOutcome) lastOutcome = blockedOutcome;

  const isBlocked = lastOutcome.status === "blocked";
  const next: BreakerEntry = {
    ...entry,
    status: isBlocked ? "blocked" : "error",
    consecutiveFailures: entry.consecutiveFailures + 1,
    lastAttemptAt: now(),
    reason: lastOutcome.error,
  };
  if (isBlocked) {
    next.cooldownUntil =
      now() +
      blockCooldownMs(blockedCooldownMs, next.consecutiveFailures, maxCooldownMs);
  } else if (next.consecutiveFailures >= failureThreshold) {
    next.cooldownUntil = now() + failureCooldownMs;
  }
  await opts.state.set(next);
  return lastOutcome;
}
