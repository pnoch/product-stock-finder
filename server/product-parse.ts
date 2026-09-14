import { invokeLLM, type InvokeParams } from "./_core/llm";
import { tryConsumeBudget } from "./spend-budget";
import * as cheerio from "cheerio";

export interface ParsedProduct {
  name: string;
  modelNumber: string;
  brand: string;
  category: string;
  description: string;
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (host === "localhost" || host === "metadata.google.internal") return true;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return true;
  if (host === "::1" || host === "::" || host === "0.0.0.0") return true;
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  const m172 = host.match(/^172\.(\d+)\./);
  if (m172 && Number(m172[1]) >= 16 && Number(m172[1]) <= 31) return true;
  if (/^0\./.test(host)) return true;
  return false;
}

function isBlockedUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return true;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
  if (url.username || url.password) return true;
  if (isPrivateHostname(url.hostname)) return true;
  return false;
}

function parseFromHtml(html: string, url: string): ParsedProduct | null {
  try {
    const $ = cheerio.load(html);
    const title =
      $('meta[property="og:title"]').attr("content")?.trim() ||
      $("title").first().text().trim() ||
      $("h1").first().text().trim() ||
      "";
    const rawTitle = title.slice(0, 200);
    if (!rawTitle) return null;
    const description =
      $('meta[property="og:description"]').attr("content")?.trim() ||
      $('meta[name="description"]').attr("content")?.trim() ||
      $("p").first().text().trim().slice(0, 1000) ||
      "";
    const host = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    })();
    const brandGuess = host ? host.split(".")[0] : "";
    const brand = brandGuess
      ? brandGuess.charAt(0).toUpperCase() + brandGuess.slice(1)
      : "";
    // Try to extract a model-like token from title or URL.
    const modelMatch =
      title.match(/[A-Z0-9][A-Za-z0-9._-]{3,}/) ||
      url.match(/\/([A-Za-z0-9_-]{4,})\/?(?:\?|$)/);
    const modelNumber = modelMatch ? modelMatch[0].replace(/^\/|\/$/g, "").slice(0, 100) : rawTitle.split(/\s+/).slice(0, 3).join("-").slice(0, 100);
    return {
      name: rawTitle,
      modelNumber: modelNumber || rawTitle.slice(0, 100),
      brand,
      category: "Other",
      description: description.slice(0, 1000),
    };
  } catch {
    return null;
  }
}

async function tryParseUrl(raw: string): Promise<ParsedProduct | null> {
  const url = raw.trim();
  if (!/^https?:\/\/\S+/i.test(url)) return null;
  if (isBlockedUrl(url)) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ProductStockFinder/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    if (!html || html.length < 200 || html.length > 1_000_000) return null;
    return parseFromHtml(html, url);
  } catch {
    return null;
  }
}

type LlmInvoke = (params: InvokeParams) => Promise<{
  choices?: Array<{ message?: { content?: unknown } }>;
}>;

const LIMITS = {
  name: 200,
  modelNumber: 100,
  brand: 100,
  category: 100,
  description: 1000,
};

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

// Extracts a product template from messy free text. Returns null when the
// LLM is unavailable or its output is unusable — callers fall back to manual
// entry. If raw is a URL, tries deterministic fetch+scrape before LLM.
export async function parseProductText(
  raw: string,
  invoke: LlmInvoke = invokeLLM,
): Promise<ParsedProduct | null> {
  const urlResult = await tryParseUrl(raw);
  if (urlResult) return urlResult;
  // Only the LLM path is billable; the deterministic URL scrape above is free.
  if (!tryConsumeBudget("products.parse")) return null;
  try {
    const result = await invoke({
      messages: [
        {
          role: "system",
          content:
            "You extract structured product data for an electronics stock tracker. " +
            "From the user's messy text (a model number, product name, or spec-sheet " +
            "paragraph), return ONLY a JSON object with keys: name (human-readable " +
            "product name), modelNumber (exact manufacturer model/part number — " +
            "preserve case and punctuation), brand, category (e.g. 'Networking " +
            "Switch', 'Router', 'Access Point'), description (1-2 factual sentences). " +
            "Never invent a model number; if the text contains none, omit it.",
        },
        { role: "user", content: raw.slice(0, 2000) },
      ],
      maxTokens: 400,
    });
    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const jsonText = content.slice(
      content.indexOf("{"),
      content.lastIndexOf("}") + 1,
    );
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;

    const name = clean(parsed.name, LIMITS.name);
    const modelNumber = clean(parsed.modelNumber, LIMITS.modelNumber);
    if (!name || !modelNumber) return null;

    return {
      name,
      modelNumber,
      brand: clean(parsed.brand, LIMITS.brand),
      category: clean(parsed.category, LIMITS.category) || "Other",
      description: clean(parsed.description, LIMITS.description),
    };
  } catch {
    return null;
  }
}
