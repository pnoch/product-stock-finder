import type { DistributorParser } from "./types";
import type { BreakerStateStore } from "./breaker-store";

export type FetchStatus = "ok" | "blocked" | "error" | "skipped";

export interface FetchOutcome {
  html?: string;
  status: FetchStatus;
  method: "plain" | "browser" | "provider" | "none";
  error?: string;
}

export type ProviderFetcher = (url: string) => Promise<string | null>;


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
