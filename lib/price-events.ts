import type { PricePoint } from "./types";

export type PriceEventType = "restock" | "price_drop" | "price_rise";

export interface PriceEvent {
  index: number;
  date: string;
  type: PriceEventType;
  price: number;
  prevPrice: number;
  stockStatus: PricePoint["stockStatus"];
  prevStockStatus: PricePoint["stockStatus"];
}

export function detectPriceEvents(history: PricePoint[]): PriceEvent[] {
  if (!history || history.length < 2) return [];
  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const events: PriceEvent[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevT = new Date(prev.date).getTime();
    const currT = new Date(curr.date).getTime();
    if (Number.isNaN(prevT) || Number.isNaN(currT)) continue;
    if (prev.stockStatus !== "in_stock" && curr.stockStatus === "in_stock") {
      events.push({
        index: i,
        date: curr.date,
        type: "restock",
        price: curr.price,
        prevPrice: prev.price,
        stockStatus: curr.stockStatus,
        prevStockStatus: prev.stockStatus,
      });
      continue;
    }
    if (prev.price > 0 && curr.price > 0) {
      const change = (curr.price - prev.price) / prev.price;
      if (change <= -0.05) {
        events.push({
          index: i,
          date: curr.date,
          type: "price_drop",
          price: curr.price,
          prevPrice: prev.price,
          stockStatus: curr.stockStatus,
          prevStockStatus: prev.stockStatus,
        });
      } else if (change >= 0.05) {
        events.push({
          index: i,
          date: curr.date,
          type: "price_rise",
          price: curr.price,
          prevPrice: prev.price,
          stockStatus: curr.stockStatus,
          prevStockStatus: prev.stockStatus,
        });
      }
    }
  }
  return events;
}

export function getEventColor(
  type: PriceEventType,
  colors: { success: string; warning: string; error: string },
): string {
  switch (type) {
    case "restock":
      return colors.success;
    case "price_drop":
      return colors.warning;
    case "price_rise":
      return colors.error;
    default:
      return colors.success;
  }
}
