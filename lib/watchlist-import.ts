import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { PRODUCT_CATALOG } from "@shared/catalog";
import { parseBulkImportCsv } from "./csv";
import { canAddToWatchlist, shouldEnforceFreeLimits } from "./pro-features";
import { addAlert, addToWatchlist, getAlerts, getWatchlist } from "./storage";
import type { Product } from "./types";

export type CsvImportResult =
  | { status: "canceled" }
  | { status: "empty" }
  | { status: "invalid" }
  | {
      status: "ok";
      added: number;
      duplicates: number;
      skipped: number;
      limited: boolean;
      truncated: boolean;
      rows: number;
    };

async function readPickedCsv(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: [
      "text/csv",
      "text/comma-separated-values",
      "application/vnd.ms-excel",
    ],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  if (Platform.OS === "web" && asset.uri) {
    return (await fetch(asset.uri)).text();
  }
  if (asset.uri) {
    return FileSystem.readAsStringAsync(asset.uri, { encoding: "utf8" });
  }
  const file = (asset as unknown as { file?: File }).file;
  return file ? file.text() : "";
}

/**
 * Picks a CSV and imports its rows into the watchlist. UI concerns (alerts,
 * paywall, reload) stay in the screen; this returns a discriminated result.
 */
export async function pickAndImportWatchlistCsv(opts: {
  isPro: boolean;
}): Promise<CsvImportResult> {
  const csv = await readPickedCsv();
  if (csv === null) return { status: "canceled" };
  if (!csv.trim()) return { status: "empty" };

  const { rows, truncated } = parseBulkImportCsv(csv);
  if (rows.length === 0) return { status: "invalid" };

  const byModel = new Map(
    PRODUCT_CATALOG.map((p) => [p.modelNumber.toLowerCase(), p] as const),
  );
  let added = 0;
  let skipped = 0;
  let duplicates = 0;
  let limited = false;
  const enforce = shouldEnforceFreeLimits();
  const currentCount = (await getWatchlist()).length;
  // Track which products already have an active alert so re-importing the same
  // CSV doesn't accumulate duplicate alerts (addAlert has no dedup).
  const existingAlertProductIds = new Set(
    (await getAlerts())
      .filter((a) => a.isActive && !a.triggeredAt)
      .map((a) => a.productId),
  );

  // Process in chunks of 50 to keep the UI responsive and respect the sync cap.
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    for (const row of chunk) {
      if (enforce && !canAddToWatchlist(currentCount + added, opts.isPro)) {
        limited = true;
        break;
      }
      const catalogHit = byModel.get(row.model.toLowerCase());
      const product = catalogHit
        ? ({
            ...catalogHit,
            tags: row.tags.length > 0 ? row.tags : catalogHit.tags,
            isWatched: true,
            addedAt: new Date().toISOString(),
          } as unknown as Product)
        : ({
            id: row.model,
            name: row.model,
            modelNumber: row.model,
            brand: "Unknown",
            category: "Switch",
            description: "",
            isWatched: true,
            addedAt: new Date().toISOString(),
            listings: [],
            tags: row.tags,
          } as unknown as Product);
      try {
        // addToWatchlist returns false when the product is already tracked;
        // count those separately so the summary doesn't claim to have added
        // products that were already on the watchlist.
        if (await addToWatchlist(product)) added += 1;
        else duplicates += 1;
        if (
          row.targetPrice !== null &&
          !existingAlertProductIds.has(product.id)
        ) {
          await addAlert({
            id: `alert-${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            productId: product.id,
            targetPrice: row.targetPrice,
            currency: row.currency,
            createdAt: new Date().toISOString(),
            isActive: true,
          });
          existingAlertProductIds.add(product.id);
        }
      } catch {
        skipped += 1;
      }
    }
    if (limited) break;
    // Yield to the event loop between chunks.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  return {
    status: "ok",
    added,
    duplicates,
    skipped,
    limited,
    truncated,
    rows: rows.length,
  };
}
