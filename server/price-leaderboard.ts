import { gte, sql } from "drizzle-orm";
import { priceHistory } from "../drizzle/schema";
import { getDb } from "./db";
import { PRODUCT_CATALOG } from "../shared/src/catalog.js";
import { DISTRIBUTORS } from "../shared/src/distributors.js";

export interface ServerPriceDrop {
  productId: string;
  productName: string;
  modelNumber: string;
  distributorId: string;
  distributorName: string;
  previousPrice: number;
  currentPrice: number;
  currency: string;
  dropPct: number;
  dropAbs: number;
  droppedAt: string;
}

function windowDays(window: string): number {
  switch (window) {
    case "24h": return 1;
    case "7d":  return 7;
    case "30d": return 30;
    default:    return 7;
  }
}

export async function topDrops(
  window: string,
  limit: number,
  sortBy: "pct" | "abs",
): Promise<ServerPriceDrop[]> {
  const db = await getDb();
  if (!db) return [];

  const days = windowDays(window);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffDay = cutoff.toISOString().slice(0, 10);

  const rows = await db
    .select({
      distributorId: priceHistory.distributorId,
      modelNumber: priceHistory.modelNumber,
      currency: priceHistory.currency,
      minPrice: sql<string>`MIN(${priceHistory.price})`.as("min_price"),
      maxPrice: sql<string>`MAX(${priceHistory.price})`.as("max_price"),
      earliestDate: sql<string>`MIN(${priceHistory.date})`.as("earliest_date"),
      latestDate: sql<string>`MAX(${priceHistory.date})`.as("latest_date"),
    })
    .from(priceHistory)
    .where(gte(priceHistory.date, cutoffDay))
    .groupBy(priceHistory.distributorId, priceHistory.modelNumber, priceHistory.currency);

  const drops: ServerPriceDrop[] = [];

  for (const row of rows) {
    const prevPrice = parseFloat(row.maxPrice);
    const currPrice = parseFloat(row.minPrice);
    if (currPrice >= prevPrice || prevPrice <= 0) continue;

    const catalog = PRODUCT_CATALOG.find((p) => p.modelNumber === row.modelNumber);
    const dist = DISTRIBUTORS.find((d) => d.id === row.distributorId);

    drops.push({
      productId: catalog?.id ?? row.modelNumber,
      productName: catalog?.name ?? row.modelNumber,
      modelNumber: row.modelNumber,
      distributorId: row.distributorId,
      distributorName: dist?.name ?? row.distributorId,
      previousPrice: prevPrice,
      currentPrice: currPrice,
      currency: row.currency,
      dropPct: ((prevPrice - currPrice) / prevPrice) * 100,
      dropAbs: prevPrice - currPrice,
      droppedAt: row.earliestDate,
    });
  }

  drops.sort((a, b) =>
    sortBy === "pct" ? b.dropPct - a.dropPct : b.dropAbs - a.dropAbs,
  );

  return drops.slice(0, limit);
}