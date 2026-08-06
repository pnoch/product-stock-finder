import { DistributorParser, ScrapeResult } from "./types";
import { PARSERS } from "./registry";
import { fetchWithParser } from "./utils";
import { StorageAdapter } from "@/lib/storage";

export type HealthStatus = "working" | "blocked" | "error";

export interface DistributorHealth {
  distributorId: string;
  status: HealthStatus;
  reason?: string;
  responseTimeMs?: number;
  lastChecked: string;
}

const HEALTH_KEY = "distributor_health";

export function classifyResult(
  html: string,
  result: ScrapeResult | null,
  error?: unknown,
): HealthStatus {
  if (error) return "error";
  if (
    html.includes("403 Forbidden") ||
    html.includes("Access Denied") ||
    html.includes("cf-browser-verification") ||
    html.includes("Checking your browser")
  ) {
    return "blocked";
  }
  if (result && result.price > 0) return "working";
  return "error";
}

export function createHealthService(adapter: StorageAdapter) {
  async function getDistributorHealth(): Promise<DistributorHealth[]> {
    try {
      const raw = await adapter.getItem(HEALTH_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async function saveDistributorHealth(
    health: DistributorHealth[],
  ): Promise<void> {
    try {
      await adapter.setItem(HEALTH_KEY, JSON.stringify(health));
    } catch {
      // Ignore save errors
    }
  }

  async function testAllDistributors(
    onProgress?: (current: number, total: number) => void,
  ): Promise<DistributorHealth[]> {
    const results: DistributorHealth[] = [];
    const CONCURRENCY = 3;
    const total = PARSERS.length;

    for (let i = 0; i < total; i += CONCURRENCY) {
      const batch = PARSERS.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (parser) => {
          const start = Date.now();
          try {
            const url = parser.buildSearchUrl("CRS326");
            const html = await fetchWithParser(parser, url);
            const result = parser.parsePrice(html);
            const status = classifyResult(html, result);
            return {
              distributorId: parser.id,
              status,
              reason: status === "error" ? "no price found" : undefined,
              responseTimeMs: Date.now() - start,
              lastChecked: new Date().toISOString(),
            } as DistributorHealth;
          } catch (error) {
            return {
              distributorId: parser.id,
              status: "error" as HealthStatus,
              reason: error instanceof Error ? error.message : String(error),
              responseTimeMs: Date.now() - start,
              lastChecked: new Date().toISOString(),
            } as DistributorHealth;
          }
        }),
      );
      results.push(...batchResults);
      onProgress?.(Math.min(i + CONCURRENCY, total), total);
    }

    await saveDistributorHealth(results);
    return results;
  }

  return { getDistributorHealth, saveDistributorHealth, testAllDistributors };
}
