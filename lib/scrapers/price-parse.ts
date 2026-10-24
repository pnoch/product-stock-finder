import type { StockStatus } from "../types";

export function inferStockStatus(text: string): StockStatus {
  const lower = text.toLowerCase();
  // Negative markers must win over substring matches like "available" in
  // "unavailable" or "in stock" in "not in stock".
  if (
    lower.includes("out of stock") ||
    lower.includes("not in stock") ||
    lower.includes("unavailable") ||
    lower.includes("not available") ||
    lower.includes("sold out") ||
    lower.includes("εκτός παραγωγής") ||
    lower.includes("εξαντλήθηκε") ||
    lower.includes("μη διαθέσιμο")
  ) {
    return "out_of_stock";
  }
  if (
    lower.includes("back order") ||
    lower.includes("backorder") ||
    lower.includes("pre-order") ||
    // Stores spell it without the hyphen too; missing it classified a preorder
    // as in_stock (a false in-stock / restock signal).
    lower.includes("preorder") ||
    lower.includes("expected") ||
    lower.includes("παραγγελία")
  ) {
    return "back_order";
  }
  if (
    lower.includes("in stock") ||
    lower.includes("available") ||
    lower.includes("add to cart") ||
    lower.includes("διαθέσιμο")
  ) {
    return "in_stock";
  }
  return "unknown";
}

// Currency markers as they appear in scraped price text. Single-char symbols
// (and the "$"-suffixed variants like "A$"/"HK$") anchor on the symbol; letter
// markers need a boundary so a stray fragment cannot anchor a model number.
const PRICE_ANCHOR_BEFORE =
  /(?:[$€£฿]|\bRM\b|\b(?:USD|EUR|GBP|MYR|AUD|NZD|CAD|ZAR|THB|SGD|HKD|AED)\b)\s*$/i;
const PRICE_ANCHOR_AFTER =
  /^\s*(?:[$€£฿]|\bRM\b|\b(?:USD|EUR|GBP|MYR|AUD|NZD|CAD|ZAR|THB|SGD|HKD|AED)\b)/i;

export function parsePriceFromText(text: string): number | null {
  // Capture digit runs including space/NBSP grouping and both separator
  // styles so "€ 1.234,56" / "R 12 345.67" survive intact.
  const matches = [...text.matchAll(/\d(?:[\d,. \u00a0\u202f]*\d)?/g)];
  if (matches.length === 0) return null;
  // A price cell can embed the model before the price ("CRS804 … $480.00"), where
  // the first digit run is the model number ("804"). Prefer a run adjacent to a
  // currency marker; fall back to the first run when nothing is anchored, which
  // preserves the old behavior for unmarked numbers.
  const isAnchored = (m: RegExpMatchArray) =>
    PRICE_ANCHOR_BEFORE.test(text.slice(0, m.index ?? 0)) ||
    PRICE_ANCHOR_AFTER.test(text.slice((m.index ?? 0) + m[0].length));
  const anchored = matches.filter(isAnchored);
  // A marker between two numbers belongs to the following one, so prefer a
  // prefix-anchored run ("RB4011 $ 219.99" → 219.99, not 4011). A run with a
  // decimal fraction is the strongest signal — it disambiguates a trailing
  // integer quantity ("480.00 EUR 2" → 480.00, not 2) while a bare model number
  // has none.
  const chosen =
    anchored.find((m) => /[.,]/.test(m[0])) ??
    matches.find((m) => PRICE_ANCHOR_BEFORE.test(text.slice(0, m.index ?? 0))) ??
    anchored[0];
  const raw = (chosen ?? matches[0]!)[0].replace(/[\s\u00a0\u202f]/g, "");
  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");
  let normalized: string;
  if (lastComma > lastDot && !/^\d{1,3}(,\d{3})+$/.test(raw)) {
    // Comma is the decimal separator (e.g. "1.234,56", "12,5"); the
    // groups-of-three exception keeps US thousands like "12,345" intact.
    normalized = raw.replace(/\./g, "").replace(/,/g, ".");
  } else if (
    lastComma === -1 &&
    /^\d{1,3}(\.\d{3})+$/.test(raw)
  ) {
    // Dot-only groups of three ("1.299", "1.234.567") are thousands separators,
    // not decimals — European distributors render whole-euro prices this way,
    // and a currency price with 3+ decimals is implausible.
    normalized = raw.replace(/\./g, "");
  } else {
    normalized = raw.replace(/,/g, "");
  }
  // `Number` (not `parseFloat`) so a malformed separator run ("1.2.3",
  // "1,23,456") is rejected outright: parseFloat silently truncated it to a
  // plausible-looking but wrong price, while the desktop parser fails closed.
  const num = Number(normalized);
  // Reject non-finite (a long digit run overflows to Infinity) as well as
  // zero, which is never a valid price.
  return !Number.isFinite(num) || num === 0 ? null : num;
}
