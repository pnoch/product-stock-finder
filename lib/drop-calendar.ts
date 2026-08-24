import type { Product } from "./types";
import { convertPrice, hasExchangeRate } from "./currency";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DropEvent {
  productId: string;
  name: string;
  from: number;
  to: number;
  percent: number;
}

export interface DropDay {
  dateKey: string;
  dropCount: number;
  biggestPct: number | null;
  drops: DropEvent[];
}

export interface DropCalendarResult {
  byDay: Map<string, DropDay>;
  totalDrops: number;
}

function convert(
  price: number,
  currency: string,
  displayCurrency: string,
): number | null {
  if (!(price > 0)) return null;
  if (
    !currency ||
    !hasExchangeRate(currency) ||
    !hasExchangeRate(displayCurrency)
  ) {
    return null;
  }
  return convertPrice(price, currency, displayCurrency);
}

function dateKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function computeDropCalendar(
  watchlist: Product[],
  displayCurrency: string,
  days = 30,
  now = Date.now(),
): DropCalendarResult {
  const cutoff = now - days * DAY_MS;
  const byDay = new Map<string, DropDay>();
  let totalDrops = 0;

  for (const product of watchlist) {
    for (const listing of product.listings) {
      const points = (listing.priceHistory ?? [])
        .map((p) => ({
          t: Date.parse(p.date),
          v: convert(p.price, p.currency, displayCurrency),
        }))
        .filter((p) => Number.isFinite(p.t) && p.v !== null)
        .sort((a, b) => a.t - b.t);

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        if (curr.t < cutoff || curr.t > now) continue;
        if (curr.v! >= prev.v!) continue;

        const key = dateKey(curr.t);
        const day = byDay.get(key) ?? {
          dateKey: key,
          dropCount: 0,
          biggestPct: null,
          drops: [],
        };
        const percent =
          Math.round(((curr.v! - prev.v!) / prev.v!) * 1000) / 10;
        day.dropCount += 1;
        day.drops.push({
          productId: product.id,
          name: product.name,
          from: prev.v!,
          to: curr.v!,
          percent,
        });
        if (day.biggestPct === null || percent < day.biggestPct) {
          day.biggestPct = percent;
        }
        byDay.set(key, day);
        totalDrops += 1;
      }
    }
  }

  return { byDay, totalDrops };
}
