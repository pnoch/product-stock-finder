import type { DistributorParser } from "./types";
import {
  backgroundSafeDelay,
  getBackgroundAppState,
} from "../background-safe-timers";
import { plainFetch } from "./plain-fetch";
import { getRandomUserAgent } from "./user-agents";

export async function fetchWithRateLimit(
  url: string,
  rateLimitMs: number,
): Promise<string> {
  // Android backgrounded: every setTimeout freezes and politeness is moot
  // inside the short background budget — skip the delay entirely there.
  if (getBackgroundAppState() === "background") {
    const response = await plainFetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.text();
  }
  await backgroundSafeDelay(rateLimitMs);
  const response = await plainFetch(url, {
    headers: {
      "User-Agent": getRandomUserAgent(),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.text();
}

export async function fetchWithParser(
  parser: DistributorParser,
  url: string,
): Promise<string> {
  if (parser.useBrowser) {
    try {
      const { fetchWithBrowser } = await import("./browser");
      return await fetchWithBrowser(url, parser.browserOptions);
    } catch {
      // Playwright unavailable (e.g. mobile) — fall back to plain HTTP
    }
  }
  return fetchWithRateLimit(url, parser.rateLimitMs);
}
