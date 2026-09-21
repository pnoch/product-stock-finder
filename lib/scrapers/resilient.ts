import { DISTRIBUTOR_BREAKER_KEY, type StorageAdapter } from "../storage";
import { getRandomUserAgent } from "./utils";
import { backgroundSafeDelay, getBackgroundAppState } from "../background-safe-timers";
import { backgroundFetch } from "../background-fetch";
import type { DistributorParser, ScrapeResult } from "./types";

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
  /** Clears a distributor's breaker so the next fetch is attempted again. */
  clear?(distributorId: string): Promise<void>;
}

// Markers of an actual block page. These must be specific: a bare
// "challenge-platform" appears as a benign Cloudflare script tag on normal
// pages, and a bare "captcha" matches reCAPTCHA site keys embedded in app
// config — both caused healthy pages to be classified as blocked.
export const BLOCKED_MARKERS = [
  "403 Forbidden",
  "Access Denied",
  "cf-browser-verification",
  "Checking your browser",
  // Cloudflare interstitial / Turnstile
  "Just a moment",
  "Attention Required",
  "/cdn-cgi/challenge-platform/scripts/jsd/main.js",
  // PerimeterX / DataDome
  "px-captcha",
  "captcha-delivery.com",
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
    async clear(distributorId) {
      entries.delete(distributorId);
    },
  };
}

// Read-modify-write serialization for the persisted breaker list. The queue is
// module-level (keyed by storage key) because the app creates several breaker
// stores over the same `distributor_breaker` key (health probes, background
// refresh, price-source); a per-instance queue would let concurrent writers
// from different instances clobber each other's entries.
const breakerQueues = new Map<string, Promise<unknown>>();

function serializeByKey<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = breakerQueues.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  breakerQueues.set(key, next.catch(() => {}));
  return next;
}

export function createStorageBreakerStore(
  adapter: Pick<StorageAdapter, "getItem" | "setItem">,
): BreakerStateStore {
  async function readList(): Promise<BreakerEntry[]> {
    try {
      const raw = await adapter.getItem(DISTRIBUTOR_BREAKER_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as BreakerEntry[]) : [];
    } catch {
      return [];
    }
  }

  return {
    get(distributorId) {
      return serializeByKey(DISTRIBUTOR_BREAKER_KEY, async () => {
        const list = await readList();
        return list.find((e) => e.distributorId === distributorId) ?? null;
      });
    },
    set(entry) {
      return serializeByKey(DISTRIBUTOR_BREAKER_KEY, async () => {
        try {
          const list = await readList();
          const next = list.filter(
            (e) => e.distributorId !== entry.distributorId,
          );
          next.push(entry);
          await adapter.setItem(DISTRIBUTOR_BREAKER_KEY, JSON.stringify(next));
        } catch {
          // Ignore persistence errors
        }
      });
    },
    clear(distributorId) {
      return serializeByKey(DISTRIBUTOR_BREAKER_KEY, async () => {
        try {
          const list = await readList();
          const next = list.filter((e) => e.distributorId !== distributorId);
          await adapter.setItem(DISTRIBUTOR_BREAKER_KEY, JSON.stringify(next));
        } catch {
          // Ignore persistence errors
        }
      });
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
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function sleep(ms: number): Promise<void> {
  // Android backgrounded: every setTimeout freezes (the paused choreographer
  // drives all timers). Rate-limit politeness is moot inside the short
  // background budget, so skip the delay entirely there.
  if (getBackgroundAppState() === "background") return Promise.resolve();
  return backgroundSafeDelay(ms);
}

async function fetchPlain(
  url: string,
  rateLimitMs: number,
  timeoutMs: number,
): Promise<{ html: string; status: number }> {
  if (getBackgroundAppState() === "background") {
    // JS timers are frozen while backgrounded, so the timeout must be
    // enforced natively (XHR timeout → OkHttp callTimeout). Capped tighter
    // than the foreground default (15s): the background task shares a 25s
    // budget across every listing, so a slow distributor must fail fast.
    return backgroundFetch(url, Math.min(timeoutMs, 10_000), {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    });
  }
  await sleep(rateLimitMs);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
      },
      signal: controller.signal,
    });
    const html = await response.text();
    return { html, status: response.status };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

export class BrowserUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BrowserUnavailableError";
  }
}

let browserUnavailableReason: string | null = null;
let browserUnavailableAt = 0;
const BROWSER_UNAVAILABLE_TTL_MS = 60_000;

async function fetchBrowser(
  parser: DistributorParser,
  url: string,
  timeoutMs?: number,
): Promise<string> {
  if (browserUnavailableReason) {
    if (Date.now() - browserUnavailableAt < BROWSER_UNAVAILABLE_TTL_MS) {
      throw new BrowserUnavailableError(browserUnavailableReason);
    }
    browserUnavailableReason = null;
  }
  let mod: typeof import("./browser");
  try {
    mod = await import("./browser");
  } catch (error) {
    browserUnavailableReason = "browser module unavailable";
    browserUnavailableAt = Date.now();
    throw new BrowserUnavailableError(browserUnavailableReason, {
      cause: error,
    });
  }
  return mod.fetchWithBrowser(url, {
    ...parser.browserOptions,
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });
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
        const html = await fetchBrowser(
          opts.parser,
          opts.url,
          opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        );
        const status = classifyFetchStatus(html);
        if (status === "ok") return { html, status: "ok", method };
        last = { status, method, error: "blocked by site" };
        // Retry a transient browser failure; only a real block should stop.
        if (status === "blocked") break;
        continue;
      }
      const { html, status: httpStatus } = await fetchPlain(
        opts.url,
        opts.parser.rateLimitMs,
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
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
      if (error instanceof BrowserUnavailableError) break;
    }
  }
  return last;
}

// One network attempt per distributor at a time: concurrent callers of the
// same parser would otherwise stampede rate limits and the breaker store.
const inFlight = new Map<string, Promise<FetchOutcome>>();

/**
 * Fetch a parser's search URL and parse it, following `resolveProductUrl` when
 * the parser needs a second hop (JS-rendered search pages). Returns the parsed
 * result plus the URL that was actually parsed.
 */
export async function fetchAndParse(
  parser: DistributorParser,
  model: string,
  state: BreakerStateStore,
): Promise<{ result: ScrapeResult | null; url: string; outcome: FetchOutcome }> {
  const searchUrl = parser.buildSearchUrl(model);
  const first = await resilientFetch({ parser, url: searchUrl, state });
  if (first.status !== "ok" || !first.html) {
    return { result: null, url: searchUrl, outcome: first };
  }
  if (parser.resolveProductUrl) {
    const resolved = parser.resolveProductUrl(first.html, model);
    // Resolvers return the raw href, which is usually relative; fetch() and
    // Playwright both reject relative URLs.
    let productUrl = resolved;
    if (resolved) {
      try {
        productUrl = new URL(resolved, searchUrl).toString();
      } catch {
        productUrl = resolved;
      }
    }
    if (productUrl) {
      const second = await resilientFetch({ parser, url: productUrl, state });
      if (second.status === "ok" && second.html) {
        return {
          result: parser.parsePrice(second.html, model, productUrl),
          url: productUrl,
          outcome: second,
        };
      }
      return { result: null, url: productUrl, outcome: second };
    }
  }
  return {
    result: parser.parsePrice(first.html, model, searchUrl),
    url: searchUrl,
    outcome: first,
  };
}

export async function resilientFetch(
  opts: ResilientFetchOptions,
): Promise<FetchOutcome> {
  const inFlightKey = `${opts.parser.id}:${(opts as unknown as { url?: string; model?: string }).url ?? (opts as unknown as { model?: string }).model ?? ""}`;
  const existing = inFlight.get(inFlightKey);
  if (existing) return existing;
  const run = runResilientFetch(opts).finally(() => {
    inFlight.delete(inFlightKey);
  });
  inFlight.set(inFlightKey, run);
  return run;
}

async function runResilientFetch(
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
      // Try the other method before giving up: a browser-detected block does
      // not imply a plain request would also be blocked (and vice versa).
      continue;
    }
    // Any hard error falls through to the next method (plain errors escalate
    // to the browser; browser errors have nothing left to try).
    continue;
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
