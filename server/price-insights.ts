import { eq, notInArray } from "drizzle-orm";
import { priceInsights, type PriceInsightsRow } from "../drizzle/schema";
import { PRODUCT_CATALOG } from "../shared/src/catalog.js";
import { getDistributorById } from "../shared/src/distributors.js";
import { getAllParserIds } from "../lib/scrapers/registry";
import { computeDealScore } from "../lib/deal-score";
import { getCachedPrice } from "./price-cache";
import { getHistory } from "./price-history";
import { getDb } from "./db";
import { tryConsumeBudget } from "./spend-budget";
import { isServerFundedLlm } from "./user-llm";
import { invokeUserLlm, type UserLlmConfig } from "./user-llm";
import type { DistributorListing } from "../lib/types";

export const INSIGHT_TTL_MS = 24 * 60 * 60 * 1000;

const memoryInsights = new Map<
  string,
  { insight: string; generatedAt: number }
>();

// Single-flight: concurrent getInsight calls for the same product share one
// LLM invocation so a burst of requests doesn't amplify cost.
// Single-flight: concurrent getInsight calls for the same product **and the
// same LLM config** share one invocation so a burst of requests doesn't
// amplify cost. Keying on productId alone would let a server-funded caller
// reuse a BYO-LLM caller's in-flight result (or vice versa).
const inFlightInsights = new Map<string, Promise<PriceInsight | null>>();

function llmIdentity(userLlm: UserLlmConfig | null): string {
  if (!userLlm) return "server";
  return `${userLlm.provider}:${userLlm.model ?? ""}:${userLlm.ollamaUrl ?? ""}`;
}

export interface PriceInsight {
  insight: string;
  generatedAt: number;
}

export async function getInsight(
  productId: string,
  userLlm: UserLlmConfig | null = null,
): Promise<PriceInsight | null> {
  const cached = await readCached(productId);
  if (cached && Date.now() - cached.generatedAt < INSIGHT_TTL_MS) {
    return cached;
  }
  const key = `${productId}::${llmIdentity(userLlm)}`;
  const existing = inFlightInsights.get(key);
  if (existing) return existing;
  const run = generateFreshInsight(productId, cached, userLlm).finally(() => {
    inFlightInsights.delete(key);
  });
  inFlightInsights.set(key, run);
  return run;
}

async function generateFreshInsight(
  productId: string,
  stale: PriceInsight | null,
  userLlm: UserLlmConfig | null,
): Promise<PriceInsight | null> {
  const context = await buildInsightContext(productId);
  if (!context) return null;
  // Budget is checked only on the billable path (cache hits returned earlier).
  // A BYO-LLM call is user-funded, so the operator's spend budget doesn't apply.
  if (isServerFundedLlm(userLlm) && !tryConsumeBudget("insights.get")) return stale;
  const text = await generateInsight(context, userLlm);
  if (!text) {
    // LLM failed: serve stale cache if available rather than null
    return stale;
  }
  const result: PriceInsight = { insight: text, generatedAt: Date.now() };
  // Only the operator's own provider output goes into the shared cache: a BYO
  // provider's text is that user's (possibly untrusted) content, and the cache
  // is keyed by productId alone, so writing it served one user's output to every
  // other user for the whole TTL.
  // ...and not cached in the process-wide memory map either (same key space):
  // a BYO result is simply returned to the caller.
  if (!userLlm) {
    await writeCached(productId, result);
  }
  return result;
}

async function readCached(productId: string): Promise<PriceInsight | null> {
  const db = await getDb();
  if (!db) {
    return memoryInsights.get(productId) ?? null;
  }
  try {
    const rows = await db
      .select()
      .from(priceInsights)
      .where(eq(priceInsights.productId, productId))
      .limit(1);
    return rows.length > 0 ? rowToInsight(rows[0]) : null;
  } catch (e) {
    // A DB blip must not turn a cache read into a 500: fall back to the
    // in-process copy so the caller still gets an answer.
    console.warn("[Insights] DB read failed; using memory cache", e);
    return memoryInsights.get(productId) ?? null;
  }
}

async function writeCached(
  productId: string,
  insight: PriceInsight,
): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryInsights.set(productId, insight);
    return;
  }
  try {
    await db
      .insert(priceInsights)
      .values({
        productId,
        insight: insight.insight,
        generatedAt: insight.generatedAt,
      })
      .onDuplicateKeyUpdate({
        set: { insight: insight.insight, generatedAt: insight.generatedAt },
      });
  } catch (e) {
    // The LLM call is already paid for; a failed write must not discard it.
    console.warn("[Insights] DB write failed; keeping memory copy", e);
    memoryInsights.set(productId, insight);
  }
}

async function buildInsightContext(
  productId: string,
): Promise<Record<string, unknown> | null> {
  const product = PRODUCT_CATALOG.find((p) => p.id === productId);
  if (!product) return null;

  const listings: DistributorListing[] = (
    await Promise.all(
      getAllParserIds().map(async (distributorId) => {
        const [history, snapshot] = await Promise.all([
          getHistory(distributorId, product.modelNumber),
          getCachedPrice(distributorId, product.modelNumber),
        ]);
        if (!history.length && !snapshot) return null;
        const latest = history[history.length - 1];
        return {
          distributorId,
          productId,
          price: snapshot?.price ?? latest?.price ?? 0,
          currency: snapshot?.currency ?? latest?.currency ?? "USD",
          stockStatus: snapshot?.stockStatus ?? latest?.stockStatus ?? "unknown",
          url: snapshot?.url ?? "",
          lastChecked: new Date(snapshot?.fetchedAt ?? Date.now()).toISOString(),
          priceHistory: history,
        } as DistributorListing;
      }),
    )
  ).filter((l): l is DistributorListing => l !== null);
  if (listings.length === 0) return null;

  return {
    productName: product.name,
    modelNumber: product.modelNumber,
    dealScore: computeDealScore(listings, "USD"),
    listings: listings.map((l) => ({
      distributorId: l.distributorId,
      distributorName:
        getDistributorById(l.distributorId)?.name ?? l.distributorId,
      region: getDistributorById(l.distributorId)?.region ?? "",
      price: l.price,
      currency: l.currency,
      stockStatus: l.stockStatus,
      history: l.priceHistory,
    })),
  };
}

async function generateInsight(
  context: Record<string, unknown>,
  userLlm: UserLlmConfig | null,
): Promise<string | null> {
  try {
    const result = await invokeUserLlm(userLlm, {
      messages: [
        {
          role: "system",
          content:
            "You are a price-analysis assistant for a networking gear stock finder. " +
            "Given a product's price history across distributors, write a short (1-3 sentence), " +
            "factual buying recommendation. Mention price trend (up/down/stable and rough %), " +
            "whether it's a good time to buy, and which distributor/region is cheapest if known. " +
            "Do not invent numbers not present in the data. " +
            "A deterministic deal score is provided (0–100, band hot/fair/wait with factor breakdown); stay consistent with its verdict — never contradict it.",
        },
        {
          role: "user",
          content: JSON.stringify(context),
        },
      ],
      maxTokens: 200,
    });
    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) return null;
    return content.trim();
  } catch {
    return null;
  }
}

export async function clearInsightsForTests(): Promise<void> {
  memoryInsights.clear();
  // DB-backed test runs share one schema, so the memory clear alone would let
  // a row written by an earlier test serve a later one.
  const db = await getDb();
  if (!db) return;
  try {
    await db.delete(priceInsights);
  } catch (e) {
    console.warn("[Insights] Failed to clear test rows", e);
  }
}

// Rows are keyed by productId and bounded by the catalog, but a product removed
// from the catalog would leave its row behind forever. Drop orphans (called
// from the warmer tick). No-op when the catalog is empty to avoid wiping all.
export async function purgeOrphanedInsights(): Promise<void> {
  const ids = PRODUCT_CATALOG.map((p) => p.id);
  if (ids.length === 0) return;
  const db = await getDb();
  if (!db) {
    for (const key of memoryInsights.keys()) {
      if (!ids.includes(key)) memoryInsights.delete(key);
    }
    return;
  }
  try {
    await db.delete(priceInsights).where(notInArray(priceInsights.productId, ids));
  } catch (e) {
    // A blip here must not abort the rest of the warmer tick.
    console.warn("[Insights] Failed to purge orphaned rows", e);
  }
}

function rowToInsight(row: PriceInsightsRow): PriceInsight {
  return { insight: row.insight, generatedAt: row.generatedAt };
}
