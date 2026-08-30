import { z } from "zod";

const RSS_FEEDS = [
  { name: "r/buildapcsales", url: "https://www.reddit.com/r/buildapcsales/.rss" },
  { name: "r/hardwareswap", url: "https://www.reddit.com/r/hardwareswap/.rss" },
  { name: "Hacker News", url: "https://hn.algolia.com/api/v1/search?query=hardware&tags=story" },
  { name: "Slickdeals", url: "https://slickdeals.net/newsearch.php?searcharea=deals&searchin=first&rss=1" },
  { name: "Tom's Hardware", url: "https://www.tomshardware.com/feeds/all" },
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

export async function fetchRssFeeds(): Promise<RssItem[]> {
  const allItems: RssItem[] = [];
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "ProductStockFinder/1.0" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      return parseRssItems(xml, feed.name);
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

export const trendingRouter = {};

const TRENDING_CACHE_URL = process.env.EXPO_PUBLIC_API_BASE_URL
  ? `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/trending`
  : "http://localhost:3001/api/trending";

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
