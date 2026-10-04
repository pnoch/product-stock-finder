import type { DistributorListing, PricePoint, Product, StockStatus } from "./types";
import { formatPrice } from "@shared/currency";
import { getBestPrice } from "./currency";
import { getDistributorById } from "@shared/distributors";

const SUMMARY_HEADER = "product,model,brand,category,bestPrice,stockStatus";
const LISTINGS_HEADER = "product,model,brand,category,distributor,price,currency,stockStatus,url";
const HISTORY_HEADER = "product,model,distributor,date,price,currency,stockStatus";

const VALID_STOCK: Set<string> = new Set(["in_stock", "back_order", "out_of_stock", "unknown"]);

function escapeCsv(value: string): string {
  // Neutralize spreadsheet formula injection: a cell starting with =, +, -, @,
  // tab, or CR is executed as a formula by Excel/Sheets. Prefix with a single
  // quote (the standard mitigation) before quoting.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  // Quote on CR too: the tokenizer treats a bare CR as a row break, so an
  // unquoted value containing one was split into two rows on re-import.
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

// Reverse escapeCsv's formula-injection prefix. A leading apostrophe before a
// formula character is a spreadsheet text-marker, not part of the value, so a
// round-trip of our own export must strip it (`=-` was re-imported as `'=-`).
// A genuine apostrophe not followed by a formula character is preserved.
function unescapeCsv(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

function resolveStockStatus(product: Product): string {
  const listings = product.listings ?? [];
  if (listings.length === 0) return "unknown";
  let hasInStock = false;
  let hasBackOrder = false;
  let hasOutOfStock = false;
  for (const l of listings) {
    if (l.stockStatus === "in_stock") hasInStock = true;
    else if (l.stockStatus === "back_order") hasBackOrder = true;
    else if (l.stockStatus === "out_of_stock") hasOutOfStock = true;
  }
  if (hasInStock) return "in_stock";
  if (hasBackOrder) return "back_order";
  if (hasOutOfStock) return "out_of_stock";
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
        // `l.price ? ...` treated a 0 price as missing; use a nullish check so
        // a genuine 0 is exported (matching priceHistoryToCsv).
        escapeCsv(typeof l.price === "number" ? String(l.price) : ""),
        escapeCsv(l.currency ?? ""),
        escapeCsv(l.stockStatus ?? "unknown"),
        escapeCsv(l.url ?? ""),
      ].join(",");
      lines.push(row);
    }
  }
  return lines.join("\n");
}

// A price point tagged with the distributor it came from. Multi-distributor
// exports (Compare, per-product history) flatten several listings' histories
// into one file, so without the tag the rows are unattributable.
export type TaggedPricePoint = PricePoint & { distributor?: string };

export function priceHistoryToCsv(
  history: TaggedPricePoint[],
  product: Pick<Product, "name" | "modelNumber">,
): string {
  const lines: string[] = [HISTORY_HEADER];
  for (const pt of history) {
    const row = [
      escapeCsv(product.name ?? ""),
      escapeCsv(product.modelNumber ?? ""),
      escapeCsv(pt.distributor ?? ""),
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
  const allHistory: TaggedPricePoint[] = (product.listings ?? []).flatMap((l) =>
    (l.priceHistory ?? []).map((pt) => ({
      ...pt,
      distributor: getDistributorById(l.distributorId)?.name ?? l.distributorId,
    })),
  );
  if (allHistory.length > 0) {
    const sorted = [...allHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return priceHistoryToCsv(sorted, { name: product.name, modelNumber: product.modelNumber });
  }
  const fallback: TaggedPricePoint[] = (product.listings ?? [])
    .filter((l) => typeof l.price === "number" && Number.isFinite(l.price))
    .map((l) => ({
      date: l.lastChecked ?? new Date().toISOString().slice(0, 10),
      price: l.price,
      currency: l.currency ?? "USD",
      stockStatus: l.stockStatus ?? "unknown",
      distributor: getDistributorById(l.distributorId)?.name ?? l.distributorId,
    }));
  return priceHistoryToCsv(fallback, { name: product.name, modelNumber: product.modelNumber });
}

// ─── Export eligibility ─────────────────────────────────────────────────────
/**
 * True when a product has price history or at least one finite listing price
 * (0 counts). Decides whether a Product Detail CSV export is useful.
 */
export function hasExportablePriceData(product: Product): boolean {
  return (product.listings ?? []).some(
    (l) =>
      (l.priceHistory?.length ?? 0) > 0 ||
      (typeof l.price === "number" && Number.isFinite(l.price)),
  );
}

// ─── CSV parsing (RFC 4180 subset: commas, quotes, escaped quotes) ─────────
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function isShareDeepLinkLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  // The deep-link header watchlistToDetailedCsv emits is exactly
  // "# Share: <url>". Matching any "#"-prefixed line dropped a legitimate
  // product whose name starts with "#" (e.g. "#1 Router") on re-import.
  if (/^#\s*share\s*:/i.test(t)) return true;
  // Legacy "//" comment lines.
  if (t.startsWith("//")) return true;
  // A header row whose first column is the share-URL column ("shareUrl,...").
  // This runs on the first *field*, so match the column name, not a literal
  // comma (which can never appear in a single field).
  if (/^shareurl$/i.test(t)) return true;
  return false;
}

// RFC4180-correct tokenizer: quoted fields may contain commas AND newlines.
// The previous implementation split on newlines first, so an exported value
// containing a newline (which escapeCsv quotes) could not be re-imported.
function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  const text = stripBom(csv);
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  let sawContent = false;

  const endField = () => {
    row.push(cur);
    cur = "";
  };
  const endRow = () => {
    endField();
    const isBlank = row.length === 1 && row[0]!.trim() === "";
    const first = row[0] ?? "";
    if (!isBlank && !isShareDeepLinkLine(first)) rows.push(row);
    row = [];
    sawContent = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      sawContent = true;
    } else if (ch === ",") {
      endField();
      sawContent = true;
    } else if (ch === "\n") {
      endRow();
    } else if (ch === "\r") {
      if (text[i + 1] !== "\n") endRow();
    } else {
      cur += ch;
      sawContent = true;
    }
  }
  if (sawContent || cur !== "" || row.length > 0) endRow();
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
      product: unescapeCsv(padded[0] ?? ""),
      model: unescapeCsv(padded[1] ?? ""),
      brand: unescapeCsv(padded[2] ?? ""),
      category: unescapeCsv(padded[3] ?? ""),
      distributor: unescapeCsv(padded[4] ?? ""),
      price: padded[5] ?? "",
      currency: padded[6] ?? "",
      stockStatus: padded[7] ?? "unknown",
      url: unescapeCsv(padded[8] ?? ""),
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
    };
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

// ─── Bulk import (model,targetPrice,currency,tags) ──────────────────────────
export type BulkImportRow = {
  model: string;
  targetPrice: number | null;
  currency: string;
  tags: string[];
};

export const BULK_MAX_ROWS = 500;

export function parseBulkImportCsv(csv: string): {
  rows: BulkImportRow[];
  /** True when the file had more rows than BULK_MAX_ROWS and was cut short. */
  truncated: boolean;
} {
  const rows = parseCsvRows(csv);
  if (rows.length === 0) return { rows: [], truncated: false };
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
  let truncated = false;
  for (const cols of dataRows) {
    if (out.length >= BULK_MAX_ROWS) {
      // Rows past the cap used to vanish silently while the summary implied a
      // complete import.
      truncated = true;
      break;
    }
    const get = (idx: number) => (idx >= 0 && idx < cols.length ? (cols[idx] ?? "") : "");
    const rawModel = unescapeCsv(get(effectiveModelIdx).trim());
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
  return { rows: out, truncated };
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
    const model = unescapeCsv((padded[1] ?? "").trim());
    const name = unescapeCsv((padded[0] ?? "").trim());
    const key = model || name;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: key,
      name: name || key,
      modelNumber: model || undefined,
      brand: unescapeCsv((padded[2] ?? "").trim()) || undefined,
      category: unescapeCsv((padded[3] ?? "").trim()) || undefined,
      description: "",
      isWatched: true,
      addedAt: new Date().toISOString(),
      listings: [],
    } as unknown as Product);
  }
  return out;
}
