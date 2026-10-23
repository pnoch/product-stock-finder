export const SUMMARY_HEADER = "product,model,brand,category,bestPrice,stockStatus";
export const LISTINGS_HEADER = "product,model,brand,category,distributor,price,currency,stockStatus,url";
export const HISTORY_HEADER = "product,model,distributor,date,price,currency,stockStatus";

export const VALID_STOCK: Set<string> = new Set(["in_stock", "back_order", "out_of_stock", "unknown"]);

export function escapeCsv(value: string): string {
  // Neutralize spreadsheet formula injection: a cell starting with =, +, -, @,
  // tab, or CR is executed as a formula by Excel/Sheets. Prefix with a single
  // quote (the standard mitigation) before quoting. A value that already starts
  // with an apostrophe is prefixed too, so unescapeCsv can strip exactly one
  // layer and round-trip a genuine leading apostrophe (see unescapeCsv).
  const safe =
    /^[=+\-@\t\r]/.test(value) || value.startsWith("'") ? `'${value}` : value;
  // Quote on CR too: the tokenizer treats a bare CR as a row break, so an
  // unquoted value containing one was split into two rows on re-import.
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

// Reverse escapeCsv's formula-injection prefix. A leading apostrophe before a
// formula character (or another apostrophe) is a spreadsheet text-marker, not
// part of the value, so a round-trip of our own export must strip it (`=-` was
// re-imported as `'=-`). A genuine apostrophe not followed by a formula
// character is preserved.
export function unescapeCsv(value: string): string {
  return /^'([=+\-@\t\r'])/.test(value) ? value.slice(1) : value;
}


