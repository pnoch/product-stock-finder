import type { DistributorListing, PricePoint, Product, StockStatus } from "./types";
import { formatPrice } from "@shared/currency";
import { getBestPrice } from "./currency";

const SUMMARY_HEADER = "product,model,brand,category,bestPrice,stockStatus";
const LISTINGS_HEADER = "product,model,brand,category,distributor,price,currency,stockStatus,url";
const HISTORY_HEADER = "product,model,date,price,currency,stockStatus";

const VALID_STOCK: Set<string> = new Set(["in_stock", "back_order", "out_of_stock", "unknown"]);

function escapeCsv(value: string): string {
  // Neutralize spreadsheet formula injection: a cell starting with =, +, -, @,
  // tab, or CR is executed as a formula by Excel/Sheets. Prefix with a single
  // quote (the standard mitigation) before quoting.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function resolveStockStatus(product: Product): string {
  const listings = product.listings ?? [];
  if (listings.length === 0) return "unknown";
  let hasInStock = false;
  let hasBackOrder = false;
  let hasOutOfStock = false;
  let hasUnknown = false;
  for (const l of listings) {
    if (l.stockStatus === "in_stock") hasInStock = true;
    else if (l.stockStatus === "back_order") hasBackOrder = true;
    else if (l.stockStatus === "out_of_stock") hasOutOfStock = true;
    else hasUnknown = true;
  }
  if (hasInStock) return "in_stock";
  if (hasBackOrder) return "back_order";
  if (hasOutOfStock) return "out_of_stock";
  if (hasUnknown) return "unknown";
  return "unknown";
}

export function watchlistToCsv(products: Product[], currency: string): string {
  const lines: string[] = [SUMMARY_HEADER];
  for (const p of products) {
    const best = getBestPrice(p.listings ?? [], currency);
    const bestPrice = best ? formatPrice(best.price, currency) : "";
    const status = resolveStockStatus(p);
    const row = [
      escapeCsv(p.name ?? ""),
      escapeCsv(p.modelNumber ?? ""),
      escapeCsv(p.brand ?? ""),
      escapeCsv(p.category ?? ""),
      escapeCsv(bestPrice),
      escapeCsv(status),
    ].join(",");
    lines.push(row);
  }
  return lines.join("\n");
}

export function watchlistToDetailedCsv(
  products: Product[],
  opts?: { shareUrl?: string },
): string {
  const lines: string[] = [];
  if (opts?.shareUrl) lines.push(`# Share: ${opts.shareUrl}`);
  lines.push(LISTINGS_HEADER);
  for (const p of products) {
    const listings = p.listings ?? [];
    if (listings.length === 0) {
      const row = [
        escapeCsv(p.name ?? ""),
        escapeCsv(p.modelNumber ?? ""),
        escapeCsv(p.brand ?? ""),
        escapeCsv(p.category ?? ""),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv("unknown"),
        escapeCsv(""),
      ].join(",");
      lines.push(row);
      continue;
    }
    for (const l of listings) {
      const row = [
        escapeCsv(p.name ?? ""),
        escapeCsv(p.modelNumber ?? ""),
        escapeCsv(p.brand ?? ""),
        escapeCsv(p.category ?? ""),
        escapeCsv(l.distributorId ?? ""),
        escapeCsv(l.price ? String(l.price) : ""),
        escapeCsv(l.currency ?? ""),
        escapeCsv(l.stockStatus ?? "unknown"),
        escapeCsv(l.url ?? ""),
      ].join(",");
      lines.push(row);
    }
  }
  return lines.join("\n");
}

export function priceHistoryToCsv(history: PricePoint[], product: Pick<Product, "name" | "modelNumber">): string {
  const lines: string[] = [HISTORY_HEADER];
  for (const pt of history) {
    const row = [
      escapeCsv(product.name ?? ""),
      escapeCsv(product.modelNumber ?? ""),
      escapeCsv(pt.date ?? ""),
      escapeCsv(String(pt.price ?? "")),
      escapeCsv(pt.currency ?? ""),
      escapeCsv(pt.stockStatus ?? "unknown"),
    ].join(",");
    lines.push(row);
  }
  return lines.join("\n");
}

// ─── Per-product history export with fallback ───────────────────────────────
export function productHistoryToCsv(product: Product): string {
  const allHistory: PricePoint[] = (product.listings ?? []).flatMap((l) => l.priceHistory ?? []);
  if (allHistory.length > 0) {
    const sorted = [...allHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return priceHistoryToCsv(sorted, { name: product.name, modelNumber: product.modelNumber });
  }
  const fallback: PricePoint[] = (product.listings ?? [])
    .filter((l) => typeof l.price === "number" && Number.isFinite(l.price))
    .map((l) => ({
      date: l.lastChecked ?? new Date().toISOString().slice(0, 10),
      price: l.price,
      currency: l.currency ?? "USD",
      stockStatus: l.stockStatus ?? "unknown",
    }));
  return priceHistoryToCsv(fallback, { name: product.name, modelNumber: product.modelNumber });
}

// ─── CSV parsing (RFC 4180 subset: commas, quotes, escaped quotes) ─────────
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function isShareDeepLinkLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (t.startsWith("#") || t.startsWith("//")) return true;
  // watchlist header share deep-link: e.g. "# Share: https://app.example/w/<token>" or header row containing shareUrl
  if (t.includes("/w/") && t.includes("http")) return true;
  if (/^shareUrl,/i.test(t)) return true;
  return false;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  const lines = stripBom(csv).split(/\r?\n/);
  for (const raw of lines) {
    if (raw.trim() === "") continue;
    if (isShareDeepLinkLine(raw)) continue;
    rows.push(parseCsvLine(raw));
  }
  return rows;
}

export type DetailedCsvRow = {
  product: string;
  model: string;
  brand: string;
  category: string;
  distributor: string;
  price: string;
  currency: string;
  stockStatus: string;
  url: string;
};

export function parseDetailedCsv(csv: string): DetailedCsvRow[] {
  const rows = parseCsvRows(csv);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const hasHeader = header[0] === "product" && header.includes("distributor");
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const out: DetailedCsvRow[] = [];
  for (const cols of dataRows) {
    if (cols.length < 5) continue;
    const padded = [...cols];
    while (padded.length < 9) padded.push("");
    out.push({
      product: padded[0] ?? "",
      model: padded[1] ?? "",
      brand: padded[2] ?? "",
      category: padded[3] ?? "",
      distributor: padded[4] ?? "",
      price: padded[5] ?? "",
      currency: padded[6] ?? "",
      stockStatus: padded[7] ?? "unknown",
      url: padded[8] ?? "",
    });
  }
  return out;
}

export function detailedCsvToProducts(rows: DetailedCsvRow[]): Product[] {
  const map = new Map<string, Product>();
  // per-distributor dedup: product + distributor collision (invite/ACL collision) — last-write-wins
  const listingSeen = new Map<string, number>();
  for (const r of rows) {
    const key = (r.model || r.product).trim();
    if (!key) continue;
    let product = map.get(key);
    if (!product) {
      product = {
        id: r.model || key,
        name: r.product || r.model,
        brand: r.brand || undefined,
        category: r.category || undefined,
        modelNumber: r.model || undefined,
        description: "",
        isWatched: true,
        addedAt: new Date().toISOString(),
        listings: [],
      } as unknown as Product;
      map.set(key, product);
    }
    if (!r.distributor) continue;
    const dedupKey = `${key}::${r.distributor}`;
    const priceNum = r.price ? Number(r.price) : 0;
    const stockStatus: StockStatus = VALID_STOCK.has(r.stockStatus) ? (r.stockStatus as StockStatus) : "unknown";
    const listing: DistributorListing = {
      distributorId: r.distributor,
      productId: product.id,
      price: Number.isFinite(priceNum) ? priceNum : 0,
      currency: r.currency || "USD",
      stockStatus,
      url: r.url || "",
      lastChecked: new Date().toISOString(),
      priceHistory: [],
    } as unknown as DistributorListing;
    if (listingSeen.has(dedupKey)) {
      const idx = listingSeen.get(dedupKey)!;
      (product.listings as DistributorListing[])[idx] = listing;
    } else {
      listingSeen.set(dedupKey, (product.listings as DistributorListing[]).length);
      (product.listings as DistributorListing[]).push(listing);
    }
  }
  return Array.from(map.values());
}

export function parseWatchlistDetailedCsv(csv: string): Product[] {
  return detailedCsvToProducts(parseDetailedCsv(csv));
}

// ─── Bulk import (model,targetPrice,currency,tags) ──────────────────────────
export type BulkImportRow = {
  model: string;
  targetPrice: number | null;
  currency: string;
  tags: string[];
};

const BULK_MAX_ROWS = 500;

export function parseBulkImportCsv(csv: string): BulkImportRow[] {
  const rows = parseCsvRows(csv);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const hasHeader = header.includes("model") || header.includes("modelnumber");
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const modelIdx = hasHeader ? header.indexOf("model") : 0;
  const modelAltIdx = hasHeader ? header.indexOf("modelnumber") : -1;
  const effectiveModelIdx = modelIdx >= 0 ? modelIdx : modelAltIdx >= 0 ? modelAltIdx : 0;
  const priceIdx = hasHeader ? header.indexOf("targetprice") : 1;
  const currencyIdx = hasHeader ? header.indexOf("currency") : 2;
  const tagsIdx = hasHeader ? header.indexOf("tags") : 3;

  const out: BulkImportRow[] = [];
  for (const cols of dataRows) {
    if (out.length >= BULK_MAX_ROWS) break;
    const get = (idx: number) => (idx >= 0 && idx < cols.length ? (cols[idx] ?? "") : "");
    const rawModel = get(effectiveModelIdx).trim();
    if (!rawModel) continue;
    const rawPrice = get(priceIdx).trim();
    const num = rawPrice ? Number(rawPrice) : NaN;
    const targetPrice = Number.isFinite(num) && num > 0 ? num : null;
    const rawCurrency = get(currencyIdx).trim() || "USD";
    const currency = rawCurrency.toUpperCase().slice(0, 8);
    const rawTags = get(tagsIdx).trim();
    const tags = rawTags
      ? rawTags
          .split(/[;,]/)
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10)
      : [];
    out.push({ model: rawModel, targetPrice, currency, tags });
  }
  return out;
}

// Unified per-distributor import entry point: handles BOM, share deep-link header,
// and invite/ACL collision dedup. Auto-detects detailed vs summary format.
export function parseWatchlistCsv(csv: string): Product[] {
  const cleaned = stripBom(csv);
  const rows = parseCsvRows(cleaned);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const isDetailed = header.includes("distributor");
  if (isDetailed) return detailedCsvToProducts(parseDetailedCsv(cleaned));
  // summary fallback: product,model,brand,category,bestPrice,stockStatus
  const hasHeader = header[0] === "product" && header.includes("model");
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const cols of dataRows) {
    const padded = [...cols];
    while (padded.length < 6) padded.push("");
    const model = (padded[1] ?? "").trim();
    const name = (padded[0] ?? "").trim();
    const key = model || name;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: key,
      name: name || key,
      modelNumber: model || undefined,
      brand: (padded[2] ?? "").trim() || undefined,
      category: (padded[3] ?? "").trim() || undefined,
      description: "",
      isWatched: true,
      addedAt: new Date().toISOString(),
      listings: [],
    } as unknown as Product);
  }
  return out;
}
