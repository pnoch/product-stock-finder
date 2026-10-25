import type { DistributorParser, ScrapeResult } from "./types";
import { classifyFetchStatus } from "./fetch-status";
import { attemptMethod } from "./fetch-methods";
import type {
  FetchOutcome,
  FetchStatus,
  ProviderFetcher,
  ResilientFetchOptions,
} from "./fetch-types";
import type { BreakerEntry, BreakerStateStore } from "./breaker-store";

export type { FetchStatus, FetchOutcome, ProviderFetcher, ResilientFetchOptions };
export {
  BLOCKED_MARKERS,
  classifyFetchStatus,
} from "./fetch-status";
export {
  createMemoryBreakerStore,
  createStorageBreakerStore,
  type BreakerEntry,
  type BreakerStateStore,
} from "./breaker-store";
export {
  BrowserUnavailableError,
  BrowserBlockedError,
} from "./fetch-methods";

let providerFetcher: ProviderFetcher | null = null;
export function setProviderFetcher(fn: ProviderFetcher | null): void {
  providerFetcher = fn;
}
export function getProviderFetcher(): ProviderFetcher | null {
  return providerFetcher;
}

async function attemptProvider(opts: ResilientFetchOptions): Promise<FetchOutcome> {
  const fetcher = providerFetcher;
  if (!fetcher) return { status: "error", method: "none", error: "no provider" };
  try {
    const html = await fetcher(opts.url);
    if (!html) return { status: "error", method: "provider", error: "provider returned nothing" };
    const status = classifyFetchStatus(html);
    if (status === "ok") return { html, status: "ok", method: "provider" };
    return { status, method: "provider", error: "provider blocked" };
  } catch (error) {
    return {
      status: "error",
      method: "provider",
      error: error instanceof Error ? error.message : String(error),
    };
  }
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

// One network attempt per distributor at a time: concurrent callers of the
// same parser would otherwise stampede rate limits and the breaker store.
const inFlight = new Map<string, Promise<FetchOutcome>>();

// Breaker stores are per-caller (the server uses a memory store, the health
// probe a storage-backed one, …). Deduping across them made every caller but
// the first observe the shared outcome while only the first store recorded it,
// so a store could miss a block it should have learned about. Identify stores
// weakly so the dedup key separates them without leaking.
const breakerStoreIds = new WeakMap<object, number>();
let nextBreakerStoreId = 1;

function breakerStoreIdOf(store: BreakerStateStore): number {
  let id = breakerStoreIds.get(store as unknown as object);
  if (id === undefined) {
    id = nextBreakerStoreId++;
    breakerStoreIds.set(store as unknown as object, id);
  }
  return id;
}

/**
 * Fetch a parser's search URL and parse it, following `resolveProductUrl` when
 * the parser needs a second hop (JS-rendered search pages). Returns the parsed
 * result plus the URL that was actually parsed.
 */
/**
 * Resolve a parser-extracted hop only when it stays on the search origin.
 * The href comes from third-party HTML, so following it blindly lets a
 * compromised result page point the server (and its unsandboxed browser) at
 * internal addresses. Cross-origin hops are rejected; parsers that need one
 * must declare it instead of trusting a scraped href.
 */
export function sameOriginProductUrl(
  resolved: string | null,
  searchUrl: string,
): string | null {
  if (!resolved) return null;
  try {
    const base = new URL(searchUrl);
    const url = new URL(resolved, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin === base.origin ? url.toString() : null;
  } catch {
    return null;
  }
}

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
    const productUrl = sameOriginProductUrl(
      parser.resolveProductUrl(first.html, model),
      searchUrl,
    );
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
  const inFlightKey = `${breakerStoreIdOf(opts.state)}:${opts.parser.id}:${opts.url}`;
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

  const methods: ("plain" | "browser")[] =
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

  // A managed provider is the last resort for a genuine block, and only when
  // one is registered (server-only). It is never tried on a plain success.
  if (blockedOutcome && providerFetcher) {
    const outcome = await attemptProvider(opts);
    if (outcome.status === "ok") {
      await recordSuccess(opts.state, opts.parser.id, now());
      return outcome;
    }
    lastOutcome = outcome;
  }

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
