import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { ProbeCapability, Verification } from "./connections";
import {
  MAX_SNAPSHOT_CARDS,
  MAX_SNAPSHOT_HTML_CHARS,
  type MarketplaceCardSnapshot,
  type MarketplacePageSnapshot,
} from "../scrapers/webview-host";

export interface FbSearchListing {
  itemId: string;
  title: string;
  price: number | null;
  currency: "THB" | null;
  location: string | null;
  url: string;
}

export interface ObservedSearchScope {
  area: string | null;
  radiusKm: number | null;
}

export function buildFbSearchUrl(input: { query: string; location: string; radiusKm: number }): string {
  const params = new URLSearchParams({ query: input.query.trim() });
  if (input.location.trim()) params.set("location", input.location.trim());
  params.set("radius", String(input.radiusKm));
  return `https://www.facebook.com/marketplace/search/?${params.toString().replace(/\+/g, "%20")}`;
}

const ITEM_HREF = 'a[href*="/marketplace/item/"]';
// A price is only accepted when a THB marker is observed on the same card;
// a bare number or a foreign currency stays unknown.
const THB_TEXT = /(?:฿|THB)\s*[\d,]+(?:\.\d{1,2})?/i;
const NO_RESULTS =
  /no (?:listings|results|matches)(?: found)?|ไม่พบ(?:ผลลัพธ์|สินค้า|ประกาศ)?|ไม่มี(?:ผลลัพธ์|สินค้า|ประกาศ)/i;
const MAX_RESULTS = 20;
const FACEBOOK_ALLOWED_HOSTS = new Set([
  "www.facebook.com",
  "web.facebook.com",
  "m.facebook.com",
]);

function itemIdFromHref(href: string | undefined): string | null {
  if (!href) return null;
  const match = /\/marketplace\/item\/([1-9]\d{0,19})(?:\/|$|\?|#)/.exec(href);
  return match ? match[1]! : null;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function absoluteItemUrl(href: string, itemId: string): string {
  if (/^https?:/i.test(href)) return href;
  try {
    return new URL(href, "https://www.facebook.com").toString();
  } catch {
    return `https://www.facebook.com/marketplace/item/${itemId}/`;
  }
}

// The smallest ancestor that contains this item link and no other item's link.
// An ancestor holding several distinct item IDs is ambiguous, so its links are
// dropped rather than risk attaching the wrong title/price/location.
function smallestCardContainer(
  $: cheerio.CheerioAPI,
  link: Element,
  itemId: string,
): Element | null {
  let node = link.parent as Element | null;
  while (node) {
    const ids = new Set<string>();
    $(node)
      .find(ITEM_HREF)
      .each((_, el) => {
        const id = itemIdFromHref($(el).attr("href") ?? "");
        if (id) ids.add(id);
      });
    if (ids.size > 1) return null;
    if (ids.size === 1 && ids.has(itemId)) return node;
    node = node.parent as Element | null;
  }
  return null;
}

function findCardLocation(
  $: cheerio.CheerioAPI,
  container: Element,
  title: string | null,
): string | null {
  let location: string | null = null;
  $(container)
    .find("span, div")
    .each((_, el) => {
      if (location) return;
      if ($(el).find(ITEM_HREF).length > 0) return;
      const text = cleanText($(el).text());
      if (!text || text.length > 60) return;
      if (/฿|THB|^\d/.test(text)) return;
      if (title && text === title) return;
      location = text;
    });
  return location;
}

export function extractFbCards(html: string): MarketplaceCardSnapshot[] {
  const $ = cheerio.load(html);
  const cards: MarketplaceCardSnapshot[] = [];
  const seen = new Set<string>();
  for (const link of $(ITEM_HREF).toArray()) {
    if (cards.length >= MAX_SNAPSHOT_CARDS) break;
    const $link = $(link);
    const href = $link.attr("href") ?? "";
    const itemId = itemIdFromHref(href);
    if (!itemId || seen.has(itemId)) continue;
    const container = smallestCardContainer($, link, itemId);
    if (!container) continue;
    seen.add(itemId);
    const title = cleanText($link.text()) || null;
    const containerText = cleanText($(container).text());
    const priceMatch = containerText.match(THB_TEXT);
    cards.push({
      itemUrl: absoluteItemUrl(href, itemId),
      title,
      priceText: priceMatch ? priceMatch[0] : null,
      location: findCardLocation($, container, title),
    });
  }
  return cards;
}

function parseThbPrice(text: string | null): number | null {
  if (!text) return null;
  const match = THB_TEXT.exec(text);
  if (!match) return null;
  const value = Number(match[0].replace(/[^\d.]/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function listingsFromCards(
  cards: readonly MarketplaceCardSnapshot[],
): FbSearchListing[] {
  const listings: FbSearchListing[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    if (listings.length >= MAX_RESULTS) break;
    const itemId = itemIdFromHref(card.itemUrl);
    if (!itemId || seen.has(itemId)) continue;
    seen.add(itemId);
    const price = parseThbPrice(card.priceText);
    listings.push({
      itemId,
      title: card.title ?? "",
      price,
      currency: price == null ? null : "THB",
      location: card.location,
      url: `https://www.facebook.com/marketplace/item/${itemId}/`,
    });
  }
  return listings;
}

export function extractFbSearchResults(html: string): FbSearchListing[] {
  return listingsFromCards(extractFbCards(html));
}

export function detectLoginWall(html: string): boolean {
  const $ = cheerio.load(html);
  if ($('input[type="password"]').length > 0) return true;
  const body = cleanText($("body").text());
  if (
    /(you must log in|log in to continue|sign in to continue|เข้าสู่ระบบเพื่อ|ลงชื่อเข้าใช้เพื่อ)/i.test(
      body,
    )
  ) {
    return true;
  }
  // A header <a>Log in</a> alone is not a wall. Demand a login form or a
  // blocking dialog with the login affordances in it.
  let found = false;
  $('[role="dialog"], [aria-modal="true"], form').each((_, el) => {
    if (found) return;
    const text = cleanText($(el).text());
    const labelled =
      /log in|sign in|forgotten password|forgot password|email address or phone number|เข้าสู่ระบบ|ลงชื่อเข้าใช้|ลืมรหัสผ่าน|อีเมลหรือเบอร์โทรศัพท์/i.test(
        text,
      );
    if (labelled && ($(el).find("input").length > 0 || /forgot/i.test(text))) {
      found = true;
    }
  });
  return found;
}

export function detectEmptyMessage(
  html: string,
  finalUrl: string,
): string | null {
  if (!facebookHostAllowed(finalUrl)) return null;
  let path = "";
  try {
    path = new URL(finalUrl).pathname;
  } catch {
    return null;
  }
  if (!/\/marketplace\/(search|category)/.test(path)) return null;
  const $ = cheerio.load(html);
  let message: string | null = null;
  $("span, div, p, h1, h2, h3").each((_, el) => {
    if (message) return;
    const text = cleanText($(el).text());
    if (text && text.length <= 120 && NO_RESULTS.test(text)) message = text;
  });
  return message;
}

export function facebookHostAllowed(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username !== "" || url.password !== "") return false;
  if (url.port !== "" && url.port !== "443") return false;
  return FACEBOOK_ALLOWED_HOSTS.has(url.hostname.toLowerCase());
}

export function snapshotFromHtml(
  html: string,
  url: string,
): MarketplacePageSnapshot {
  return {
    url,
    html: html.slice(0, MAX_SNAPSHOT_HTML_CHARS),
    cards: extractFbCards(html),
    scope: { area: null, radiusKm: null },
    emptyMessage: detectEmptyMessage(html, url),
    loginVisible: detectLoginWall(html),
  };
}

export type FbSearchState =
  | {
      kind: "listings";
      listings: FbSearchListing[];
      observedScope: ObservedSearchScope;
    }
  | { kind: "login_required" }
  | { kind: "empty" }
  | { kind: "unverified"; reason: string }
  | { kind: "unavailable" };

// Observed scope comes from the page, never from the requested URL params: a
// redirect to San Francisco must not be reported as the Bangkok we asked for.
export function classifyFbSearchPage(
  snapshot: MarketplacePageSnapshot,
): FbSearchState {
  if (snapshot.loginVisible) return { kind: "login_required" };
  if (!facebookHostAllowed(snapshot.url)) {
    return { kind: "unverified", reason: "final-host" };
  }
  const listings = listingsFromCards(snapshot.cards);
  if (listings.length > 0) {
    return { kind: "listings", listings, observedScope: snapshot.scope };
  }
  if (snapshot.emptyMessage) return { kind: "empty" };
  return { kind: "unverified", reason: "unreadable" };
}

export async function searchFbMarketplace(input: {
  query: string;
  location: string;
  radiusKm: number;
  loadHtml?: (url: string) => Promise<string>;
  snapshot?: (url: string) => Promise<MarketplacePageSnapshot>;
}): Promise<FbSearchState> {
  const url = buildFbSearchUrl(input);
  try {
    if (input.snapshot) return classifyFbSearchPage(await input.snapshot(url));
    const { getWebViewHost } = await import("../scrapers/webview-host");
    const host = getWebViewHost();
    if (host?.snapshot) {
      return classifyFbSearchPage(await host.snapshot(url, { timeoutMs: 25000 }));
    }
    const loadHtml =
      input.loadHtml ??
      (async (target: string) => {
        if (!host) throw new Error("unavailable");
        return host.load(target, { timeoutMs: 25000 });
      });
    return classifyFbSearchPage(snapshotFromHtml(await loadHtml(url), url));
  } catch {
    return { kind: "unavailable" };
  }
}

export interface ListingProbeReading {
  identityMatched: boolean;
  price: number | null;
}

export function facebookListingReader(expectedItemId: string) {
  return (snapshot: MarketplacePageSnapshot): ListingProbeReading => {
    const match = listingsFromCards(snapshot.cards).find(
      (listing) => listing.itemId === expectedItemId,
    );
    return { identityMatched: Boolean(match), price: match?.price ?? null };
  };
}

// Turns a rendered page into a verification state for one capability.
// Navigation-only probes can never be ready. A search probe needs recognized
// cards or a verified-empty search page. A listing probe needs identity plus a
// readable price, supplied per site (Facebook cards; Shopee/Lazada reuse their
// own extractors through readListing).
export function evaluateProbe(input: {
  capability: ProbeCapability;
  snapshot: MarketplacePageSnapshot;
  readListing?: (snapshot: MarketplacePageSnapshot) => ListingProbeReading;
  hostAllowed?: (url: string) => boolean;
  now?: string;
}): Verification {
  const checkedAt = input.now ?? new Date().toISOString();
  if (input.capability.kind === "navigation") {
    return { kind: "unverified", checkedAt, reason: "navigation-only" };
  }
  if (input.snapshot.loginVisible) return { kind: "login_required", checkedAt };
  const hostAllowed = input.hostAllowed ?? facebookHostAllowed;
  if (!hostAllowed(input.snapshot.url)) {
    return { kind: "unverified", checkedAt, reason: "final-host" };
  }
  if (input.capability.kind === "search") {
    const listings = listingsFromCards(input.snapshot.cards);
    if (listings.length > 0 || input.snapshot.emptyMessage) {
      return { kind: "ready", checkedAt, capability: input.capability };
    }
    return { kind: "unverified", checkedAt, reason: "no-recognized-results" };
  }
  if (!input.readListing) {
    return { kind: "unverified", checkedAt, reason: "no-listing-reader" };
  }
  const reading = input.readListing(input.snapshot);
  if (reading.identityMatched && reading.price != null) {
    return { kind: "ready", checkedAt, capability: input.capability };
  }
  return { kind: "unverified", checkedAt, reason: "listing-unconfirmed" };
}
