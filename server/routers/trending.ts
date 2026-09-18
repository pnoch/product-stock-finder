import { router, adminProcedure, publicProcedure } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";
import { tryConsumeBudget } from "../spend-budget";
import { getDb } from "../db";
import { trendingProducts } from "../../drizzle/schema";
import { desc, gte } from "drizzle-orm";

// External feeds and the OpenAI call must not hang a request forever.
const FETCH_TIMEOUT_MS = 8000;
const LLM_TIMEOUT_MS = 20_000;

function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

const RSS_FEEDS = [
  { name: "r/buildapcsales", url: "https://www.reddit.com/r/buildapcsales/.rss", type: "xml" as const },
  { name: "r/hardwareswap", url: "https://www.reddit.com/r/hardwareswap/.rss", type: "xml" as const },
  { name: "Hacker News", url: "https://hn.algolia.com/api/v1/search?query=hardware&tags=story", type: "json" as const },
  { name: "Slickdeals", url: "https://slickdeals.net/newsearch.php?searcharea=deals&searchin=first&rss=1", type: "xml" as const },
  { name: "Tom's Hardware", url: "https://www.tomshardware.com/feeds/all", type: "xml" as const },
];

interface RssItem {
  title: string;
  link: string;
  source: string;
}

function parseRssItems(xml: string, source: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    const linkMatch = block.match(/<link>(.*?)<\/link>/);
    const title = titleMatch?.[1] || titleMatch?.[2] || "";
    const link = linkMatch?.[1] || "";
    if (title.trim()) {
      items.push({ title: title.trim(), link: link.trim(), source });
    }
  }
  return items;
}

function parseJsonFeed(body: string, source: string): RssItem[] {
  try {
    const data = JSON.parse(body) as { hits?: Array<{ title?: string; url?: string; story_title?: string }> };
    return (data.hits ?? [])
      .map((h) => ({ title: (h.title ?? h.story_title ?? "").trim(), link: h.url ?? "", source }))
      .filter((i) => i.title.length > 0);
  } catch {
    return [];
  }
}

export async function fetchRssFeeds(): Promise<RssItem[]> {
  const allItems: RssItem[] = [];
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const res = await fetchWithTimeout(feed.url, {
        headers: { "User-Agent": "ProductStockFinder/1.0" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      return feed.type === "json" ? parseJsonFeed(body, feed.name) : parseRssItems(body, feed.name);
    }),
  );
  for (const r of results) {
    if (r.status === "fulfilled") allItems.push(...r.value);
  }
  return allItems;
}

export function buildTrendingPrompt(items: RssItem[], watchlistNames: string[]): string {
  const itemText = items
    .slice(0, 50)
    .map((i) => `- [${i.source}] ${i.title}`)
    .join("\n");
  const exclude = watchlistNames.length
    ? `\nExclude these products already in the user's watchlist: ${watchlistNames.join(", ")}`
    : "";
  return `Given these trending products from tech communities, which are hardest to find or most in demand? Return top 10 with JSON array containing: name (string), brand (string), category (string), estimatedPrice (number, USD), reason (1-sentence scarcity reason), source (which feed it came from).${exclude}

Trending items:
${itemText}

Return ONLY valid JSON array, no markdown.`;
}

export interface TrendingLlmRow {
  name: unknown;
  brand: unknown;
  category: unknown;
  estimatedPrice: unknown;
  reason: unknown;
  source: unknown;
}

export interface SanitizedTrendingRow {
  name: string;
  brand: string;
  category: string;
  estimatedPrice: string;
  reason: string;
  source: string;
}

function cleanStr(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

// Bounds raw LLM output to the trendingProducts column limits so an
// over-long or non-finite model reply fails safe instead of 500ing the
// insert (name 255, brand/category 100, price decimal(10,2), source 255).
export function sanitizeTrendingRows(rows: TrendingLlmRow[]): SanitizedTrendingRow[] {
  return rows.map((p) => {
    const price =
      typeof p.estimatedPrice === "number" && Number.isFinite(p.estimatedPrice)
        ? Math.min(Math.max(p.estimatedPrice, 0), 99999999.99)
        : 0;
    return {
      name: cleanStr(p.name, 255),
      brand: cleanStr(p.brand, 100),
      category: cleanStr(p.category, 100),
      estimatedPrice: price.toFixed(2),
      reason: cleanStr(p.reason, 1000),
      source: cleanStr(p.source, 255),
    };
  });
}

export const trendingRouter = router({
  get: publicProcedure.query(async ({ ctx }) => {
    checkRateLimit(ctx, "trending.get", 30, 60_000);
    const db = await getDb();
    if (!db) return [];
    const now = new Date();
    // LIMIT + ORDER BY in SQL: without them this reads every non-expired row
    // into memory and returns an arbitrary 10.
    const rows = await db
      .select()
      .from(trendingProducts)
      .where(gte(trendingProducts.expiresAt, now))
      .orderBy(desc(trendingProducts.fetchedAt))
      .limit(10);
    return rows;
  }),

  refresh: adminProcedure.mutation(async ({ ctx }) => {
    checkRateLimit(ctx, "trending.refresh", 2, 60_000);
    // Process-wide cap on the paid OpenAI call (admin-only, but still billable).
    if (!tryConsumeBudget("trending.refresh")) {
      return { count: 0 };
    }
    const items = await fetchRssFeeds();
    if (items.length === 0) return { count: 0 };

    const prompt = buildTrendingPrompt(items, []);
    const aiController = new AbortController();
    const aiTimer = setTimeout(() => aiController.abort(), LLM_TIMEOUT_MS);
    let aiRes: Response;
    try {
      aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
        }),
        signal: aiController.signal,
      });
    } finally {
      clearTimeout(aiTimer);
    }

    if (!aiRes.ok) return { count: 0 };

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content ?? "[]";

    let products: TrendingLlmRow[];

    try {
      const raw: unknown = JSON.parse(content);
      if (!Array.isArray(raw)) return { count: 0 };
      products = raw as TrendingLlmRow[];
    } catch {
      return { count: 0 };
    }

    const db = await getDb();
    if (!db) return { count: 0 };

    const nowMs = Date.now();
    const expiresAt = new Date(nowMs + 6 * 60 * 60 * 1000);
    const rows = sanitizeTrendingRows(products.slice(0, 10))
      .filter((p) => p.name.length > 0)
      .map((p) => ({
        id: crypto.randomUUID(),
        name: p.name,
        brand: p.brand,
        category: p.category,
        estimatedPrice: p.estimatedPrice,
        currency: "USD",
        reason: p.reason,
        source: p.source,
        fetchedAt: new Date(nowMs),
        expiresAt,
      }));

    await db.delete(trendingProducts);
    if (rows.length > 0) {
      await db.insert(trendingProducts).values(rows);
    }

    return { count: rows.length };
  }),
});
