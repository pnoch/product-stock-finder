import { eq } from "drizzle-orm";
import { priceInsights, type PriceInsightsRow } from "../drizzle/schema";
import { PRODUCT_CATALOG } from "../lib/catalog";
import { getDistributorById } from "../lib/distributors";
import { getAllParserIds } from "../lib/scrapers/registry";
import { getCachedPrice } from "./price-cache";
import { getHistory } from "./price-history";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import type { DistributorListing } from "../lib/types";

export const INSIGHT_TTL_MS = 24 * 60 * 60 * 1000;

const memoryInsights = new Map<
  string,
  { insight: string; generatedAt: number }
>();

export interface PriceInsight {
  insight: string;
  generatedAt: number;
}

export async function getInsight(
  productId: string,
): Promise<PriceInsight | null> {
  const cached = await readCached(productId);
  if (cached && Date.now() - cached.generatedAt < INSIGHT_TTL_MS) {
    return cached;
  }
  const context = await buildInsightContext(productId);
  if (!context) return null;
  const text = await generateInsight(context);
  if (!text) return null;
  const result: PriceInsight = { insight: text, generatedAt: Date.now() };
  await writeCached(productId, result);
  return result;
}

async function readCached(
  productId: string,
): Promise<PriceInsight | null> {
  const db = await getDb();
  if (!db) {
    return memoryInsights.get(productId) ?? null;
  }
  const rows = await db
    .select()
    .from(priceInsights)
    .where(eq(priceInsights.productId, productId))
    .limit(1);
  return rows.length > 0 ? rowToInsight(rows[0]) : null;
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
  await db
    .insert(priceInsights)
    .values({ productId, insight: insight.insight, generatedAt: insight.generatedAt })
    .onDuplicateKeyUpdate({
      set: { insight: insight.insight, generatedAt: insight.generatedAt },
    });
}

async function buildInsightContext(
  productId: string,
): Promise<Record<string, unknown> | null> {
  const product = PRODUCT_CATALOG.find((p) => p.id === productId);
  if (!product) return null;

  const listings: DistributorListing[] = [];
  for (const distributorId of getAllParserIds()) {
    const history = await getHistory(distributorId, product.modelNumber);
    const snapshot = await getCachedPrice(distributorId, product.modelNumber);
    if (!history.length && !snapshot) continue;
    const latest = history[history.length - 1];
    listings.push({
      distributorId,
      productId,
      price: snapshot?.price ?? latest?.price ?? 0,
      currency: snapshot?.currency ?? latest?.currency ?? "USD",
      stockStatus: snapshot?.stockStatus ?? latest?.stockStatus ?? "unknown",
      url: snapshot?.url ?? "",
      lastChecked: new Date(snapshot?.fetchedAt ?? Date.now()).toISOString(),
      priceHistory: history,
    });
  }
  if (listings.length === 0) return null;

  return {
    productName: product.name,
    modelNumber: product.modelNumber,
    listings: listings.map((l) => ({
      distributorId: l.distributorId,
      distributorName: getDistributorById(l.distributorId)?.name ?? l.distributorId,
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
): Promise<string | null> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a price-analysis assistant for a networking gear stock finder. " +
            "Given a product's price history across distributors, write a short (1-3 sentence), " +
            "factual buying recommendation. Mention price trend (up/down/stable and rough %), " +
            "whether it's a good time to buy, and which distributor/region is cheapest if known. " +
            "Do not invent numbers not present in the data.",
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

export function clearInsightsForTests(): void {
  memoryInsights.clear();
}

function rowToInsight(row: PriceInsightsRow): PriceInsight {
  return { insight: row.insight, generatedAt: row.generatedAt };
}
