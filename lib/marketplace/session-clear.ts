import type { Cookie } from "@react-native-cookies/cookies";
import { getWebViewHost, type WebViewHost } from "@/lib/scrapers/webview-host";
import {
  marketplaceAllowedHosts,
  type MarketplaceConnectionsService,
  type MarketplaceSite,
  type Verification,
} from "./connections";

export const DEFAULT_DISCONNECT_WAIT_MS = 15_000;
export const CLEAR_PARTIAL_REASON =
  "This marketplace session could not be fully cleared. Disconnect again to retry.";
export const CLEAR_TIMEOUT_REASON =
  "Timed out waiting for this marketplace's in-flight pages to stop. Disconnect again to retry.";
export const CLEAR_UNAVAILABLE_REASON =
  "On-device session clearing is unavailable on this platform.";

const EXPIRED = "1970-01-01T00:00:00.000Z";

export type MarketplaceClearOutcome = "complete" | "partial" | "unavailable";

export interface MarketplaceClearResult {
  site: MarketplaceSite;
  outcome: MarketplaceClearOutcome;
  expiredCookies: number;
  failedCookies: number;
  originCleared: boolean;
  reason: string | null;
}

export interface MarketplaceCookie {
  name: string;
  value?: string;
  domain?: string;
  path?: string;
  [key: string]: unknown;
}

// The native cookie manager, narrowed to what disconnect uses. Injected so the
// clearing logic is testable without the native module, and wrapped (never
// referenced by hooks) so cookie values stay inside the clearing boundary.
export interface MarketplaceCookieManager {
  get(url: string): Promise<Record<string, MarketplaceCookie>>;
  set(url: string, cookie: MarketplaceCookie): Promise<boolean>;
}

export interface MarketplaceOperationTracker {
  // Returns false while the site is disconnecting, so a new verification cannot
  // start mid-clear.
  begin(site: MarketplaceSite): boolean;
  end(site: MarketplaceSite): void;
  isDisconnecting(site: MarketplaceSite): boolean;
  markDisconnecting(site: MarketplaceSite, value: boolean): void;
  // Resolves true once no operation for the site is active; false on timeout.
  waitForIdle(site: MarketplaceSite, timeoutMs: number): Promise<boolean>;
  // Best-effort cancellation of in-flight WebView requests for the site.
  terminate(site: MarketplaceSite): Promise<void>;
}

interface SiteTrackerState {
  active: number;
  disconnecting: boolean;
  waiters: (() => void)[];
}

class MarketplaceOperationTrackerImpl implements MarketplaceOperationTracker {
  private readonly states: Record<MarketplaceSite, SiteTrackerState> = {
    facebook: { active: 0, disconnecting: false, waiters: [] },
    shopee: { active: 0, disconnecting: false, waiters: [] },
    lazada: { active: 0, disconnecting: false, waiters: [] },
  };

  begin(site: MarketplaceSite): boolean {
    if (this.states[site].disconnecting) return false;
    this.states[site].active += 1;
    return true;
  }

  end(site: MarketplaceSite): void {
    const state = this.states[site];
    if (state.active > 0) state.active -= 1;
    if (state.active === 0) this.release(site);
  }

  isDisconnecting(site: MarketplaceSite): boolean {
    return this.states[site].disconnecting;
  }

  markDisconnecting(site: MarketplaceSite, value: boolean): void {
    this.states[site].disconnecting = value;
  }

  waitForIdle(site: MarketplaceSite, timeoutMs: number): Promise<boolean> {
    const state = this.states[site];
    if (state.active === 0) return Promise.resolve(true);
    if (timeoutMs <= 0) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        resolve(false);
      }, timeoutMs);
      state.waiters.push(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(true);
      });
    });
  }

  async terminate(site: MarketplaceSite): Promise<void> {
    const state = this.states[site];
    if (state.active === 0) return;
    state.active = 0;
    this.release(site);
  }

  private release(site: MarketplaceSite): void {
    const state = this.states[site];
    const waiters = state.waiters;
    state.waiters = [];
    for (const waiter of waiters) waiter();
  }
}

export function createMarketplaceOperationTracker(): MarketplaceOperationTracker {
  return new MarketplaceOperationTrackerImpl();
}

let sharedTracker: MarketplaceOperationTracker | null = null;

export function getMarketplaceOperationTracker(): MarketplaceOperationTracker {
  if (!sharedTracker) sharedTracker = createMarketplaceOperationTracker();
  return sharedTracker;
}

async function loadCookieManager(): Promise<MarketplaceCookieManager | null> {
  try {
    const mod = await import("@react-native-cookies/cookies");
    const manager = mod.default;
    return {
      get: async (url) =>
        (await manager.get(url)) as unknown as Record<string, MarketplaceCookie>,
      set: (url, cookie) => manager.set(url, cookie as Cookie),
    };
  } catch {
    return null;
  }
}

// The cookie's own domain/path, not the enumeration URL: a cookie scoped to
// `.facebook.com` and `/marketplace` must be expired at that exact combination.
function cookieExpiryUrl(cookie: MarketplaceCookie): string | null {
  const domain = (cookie.domain ?? "").replace(/^\./, "").trim();
  if (!domain) return null;
  const path =
    typeof cookie.path === "string" && cookie.path.startsWith("/")
      ? cookie.path
      : "/";
  return `https://${domain}${path}`;
}

function cookieKey(cookie: MarketplaceCookie, fallbackHost: string): string {
  return `${cookie.domain ?? fallbackHost}|${cookie.path ?? "/"}|${cookie.name}`;
}

async function expireSiteCookies(
  manager: MarketplaceCookieManager,
  hosts: readonly string[],
): Promise<{ expired: number; failed: number }> {
  const seen = new Set<string>();
  const targets: MarketplaceCookie[] = [];
  for (const host of hosts) {
    let cookies: Record<string, MarketplaceCookie> = {};
    try {
      cookies = (await manager.get(`https://${host}/`)) ?? {};
    } catch {
      continue;
    }
    for (const cookie of Object.values(cookies)) {
      if (!cookie || typeof cookie.name !== "string") continue;
      const key = cookieKey(cookie, host);
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push(cookie);
    }
  }

  let expired = 0;
  let failed = 0;
  for (const cookie of targets) {
    const url = cookieExpiryUrl(cookie) ?? `https://${hosts[0]}/`;
    try {
      const ok = await manager.set(url, { ...cookie, value: "", expires: EXPIRED });
      if (ok) expired += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { expired, failed };
}

async function clearSiteOrigins(
  host: WebViewHost,
  hosts: readonly string[],
): Promise<boolean> {
  let allCleared = true;
  for (const hostName of hosts) {
    try {
      await host.clearStorage(`https://${hostName}/`);
    } catch {
      allCleared = false;
    }
  }
  return allCleared;
}

export interface ClearMarketplaceSessionOptions {
  connections: Pick<
    MarketplaceConnectionsService,
    "invalidate" | "beginVerification" | "complete"
  >;
  host?: WebViewHost | null;
  cookieManager?: MarketplaceCookieManager | null;
  operations?: MarketplaceOperationTracker;
  waitTimeoutMs?: number;
}

// A non-complete result leaves the site's verification uncertain rather than
// claiming the user is signed out.
async function applyResult(
  connections: ClearMarketplaceSessionOptions["connections"],
  result: MarketplaceClearResult,
): Promise<MarketplaceClearResult> {
  if (result.outcome === "complete") return result;
  const verification: Verification =
    result.outcome === "unavailable"
      ? { kind: "unavailable" }
      : {
          kind: "unverified",
          checkedAt: new Date().toISOString(),
          reason: result.reason ?? CLEAR_PARTIAL_REASON,
        };
  const generation = connections.beginVerification(result.site);
  await connections.complete(result.site, generation, verification);
  return result;
}

// Clears only the selected site's cookies and origin storage, waits for that
// site's in-flight pages to stop first, and never falls back to clearAll().
export async function clearMarketplaceSession(
  site: MarketplaceSite,
  options: ClearMarketplaceSessionOptions,
): Promise<MarketplaceClearResult> {
  const operations = options.operations ?? getMarketplaceOperationTracker();
  const timeoutMs = options.waitTimeoutMs ?? DEFAULT_DISCONNECT_WAIT_MS;
  const hosts = marketplaceAllowedHosts(site);

  operations.markDisconnecting(site, true);
  try {
    // Invalidate before touching storage: a probe completing mid-disconnect is
    // dropped by generation, and begin() refuses new work while disconnecting.
    await options.connections.invalidate(site);

    const idle = await operations.waitForIdle(site, timeoutMs);
    if (!idle) {
      await operations.terminate(site);
      const forced = await operations.waitForIdle(site, 0);
      if (!forced) {
        return await applyResult(options.connections, {
          site,
          outcome: "partial",
          expiredCookies: 0,
          failedCookies: 0,
          originCleared: false,
          reason: CLEAR_TIMEOUT_REASON,
        });
      }
    }

    const manager =
      options.cookieManager === undefined
        ? await loadCookieManager()
        : options.cookieManager;
    const host =
      options.host === undefined ? getWebViewHost() : options.host;

    if (!manager && !host) {
      return await applyResult(options.connections, {
        site,
        outcome: "unavailable",
        expiredCookies: 0,
        failedCookies: 0,
        originCleared: false,
        reason: CLEAR_UNAVAILABLE_REASON,
      });
    }

    let expiredCookies = 0;
    let failedCookies = 0;
    if (manager) {
      const cookies = await expireSiteCookies(manager, hosts);
      expiredCookies = cookies.expired;
      failedCookies = cookies.failed;
    } else {
      // No cookie boundary: browser cookies cannot be expired, so this can only
      // ever be a partial clear.
      failedCookies = 1;
    }

    const originCleared = host ? await clearSiteOrigins(host, hosts) : false;
    const complete = failedCookies === 0 && originCleared;
    return await applyResult(options.connections, {
      site,
      outcome: complete ? "complete" : "partial",
      expiredCookies,
      failedCookies,
      originCleared,
      reason: complete ? null : CLEAR_PARTIAL_REASON,
    });
  } finally {
    operations.markDisconnecting(site, false);
  }
}
