import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";
import { getDb } from "../db";
import { trendingProducts } from "../../drizzle/schema";
import { gte } from "drizzle-orm";

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
      const res = await fetch(feed.url, {
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

export const trendingRouter = router({
  get: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const now = new Date();
    const rows = await db
      .select()
      .from(trendingProducts)
      .where(gte(trendingProducts.expiresAt, now));
    return rows.slice(0, 10);
  }),

  refresh: protectedProcedure.mutation(async ({ ctx }) => {
    checkRateLimit(ctx, "trending.refresh", 5, 60_000);
    const items = await fetchRssFeeds();
    if (items.length === 0) return { count: 0 };

    const prompt = buildTrendingPrompt(items, []);
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
    });

    if (!aiRes.ok) return { count: 0 };

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content ?? "[]";

    let products: Array<{
      name: string;
      brand: string;
      category: string;
      estimatedPrice: number;
      reason: string;
      source: string;
    }>;

    try {
      products = JSON.parse(content);
    } catch {
      return { count: 0 };
    }

    if (!Array.isArray(products)) return { count: 0 };

    const db = await getDb();
    if (!db) return { count: 0 };

    const nowMs = Date.now();
    const expiresAt = new Date(nowMs + 6 * 60 * 60 * 1000);
    const rows = products.slice(0, 10).map((p) => ({
      id: crypto.randomUUID(),
      name: p.name,
      brand: p.brand,
      category: p.category,
      estimatedPrice: String(p.estimatedPrice),
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

const TRENDING_CACHE_URL = process.env.EXPO_PUBLIC_API_BASE_URL
  ? `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/trending`
  : "http://localhost:3000/api/trending";

export async function getTrending(): Promise<
  Array<{
    id: string;
    name: string;
    brand: string;
    category: string;
    estimatedPrice: number;
    currency: string;
    reason: string;
    source: string;
    fetchedAt: string;
    expiresAt: string;
  }>
> {
  try {
    const res = await fetch(TRENDING_CACHE_URL);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
