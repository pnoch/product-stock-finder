import { getRandomUserAgent } from "./utils";
import { backgroundSafeDelay, getBackgroundAppState } from "../background-safe-timers";
import { backgroundFetch } from "../background-fetch";
import { plainFetch } from "./plain-fetch";
import type { DistributorParser } from "./types";
import { classifyFetchStatus } from "./fetch-status";
import type { FetchOutcome, ResilientFetchOptions } from "./fetch-types";

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
    const response = await plainFetch(url, {
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

/**
 * The site definitively blocked the headless browser (a 403 body or a
 * challenge that never resolves). Kept distinct from BrowserUnavailableError so
 * the retry loop can report `blocked` and stop instead of re-driving the same
 * blocking navigation, which only compounds the block.
 */
export class BrowserBlockedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BrowserBlockedError";
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

export async function attemptMethod(
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
      // A definitive block must not be retried: report it so the caller takes
      // the blocked-cooldown path rather than hammering the challenge.
      if (error instanceof BrowserBlockedError) {
        last = { status: "blocked", method, error: last.error };
        break;
      }
    }
  }
  return last;
}
