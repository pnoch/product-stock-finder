import { formatPrice, getBestPrice } from "./currency";
import type { AppSettings, PriceAlert, Product, StockStatus } from "./types";

export interface DigestProductState {
  productId: string;
  name: string;
  bestPrice: number | null;
  stockStatus: StockStatus;
}

export interface DigestSnapshot {
  lastDigestAt: string;
  products: DigestProductState[];
}

export interface DigestSummary {
  totalValue: number;
  inStock: number;
  backOrder: number;
  outOfStock: number;
  unknown: number;
}

export interface DigestResult {
  summary: DigestSummary;
  priceChanges: {
    productId: string;
    name: string;
    from: number;
    to: number;
    percent: number;
  }[];
  stockChanges: {
    productId: string;
    name: string;
    from: StockStatus;
    to: StockStatus;
  }[];
  alertTargetsHit: {
    productId: string;
    name: string;
    price: number;
    currency: string;
  }[];
}

export type DigestSender = (title: string, body: string) => Promise<void>;

function productState(
  product: Product,
  displayCurrency: string,
): DigestProductState {
  const best = getBestPrice(product.listings, displayCurrency);
  const inStock = product.listings.some(
    (l) => l.stockStatus === "in_stock" && l.price > 0,
  );
  const backOrder = product.listings.some(
    (l) => l.stockStatus === "back_order",
  );
  const stockStatus: StockStatus = inStock
    ? "in_stock"
    : backOrder
      ? "back_order"
      : "out_of_stock";
  return {
    productId: product.id,
    name: product.name,
    bestPrice: best?.price ?? null,
    stockStatus,
  };
}

function buildSummary(products: DigestProductState[]): DigestSummary {
  return products.reduce(
    (acc, p) => {
      acc.totalValue += p.bestPrice ?? 0;
      if (p.stockStatus === "in_stock") acc.inStock += 1;
      else if (p.stockStatus === "back_order") acc.backOrder += 1;
      else if (p.stockStatus === "out_of_stock") acc.outOfStock += 1;
      else acc.unknown += 1;
      return acc;
    },
    { totalValue: 0, inStock: 0, backOrder: 0, outOfStock: 0, unknown: 0 },
  );
}

export function computeDigest(
  previous: DigestSnapshot | null,
  watchlist: Product[],
  settings: AppSettings,
  alerts: PriceAlert[],
): DigestResult {
  const displayCurrency = settings.displayCurrency;
  const current = watchlist.map((p) => productState(p, displayCurrency));
  const prevMap = new Map(
    (previous?.products ?? []).map((p) => [p.productId, p] as const),
  );

  const priceChanges: DigestResult["priceChanges"] = [];
  const stockChanges: DigestResult["stockChanges"] = [];

  for (const state of current) {
    const prev = prevMap.get(state.productId);
    if (prev && prev.bestPrice != null && state.bestPrice != null) {
      const from = prev.bestPrice;
      const to = state.bestPrice;
      if (from !== to) {
        priceChanges.push({
          productId: state.productId,
          name: state.name,
          from,
          to,
          percent: ((to - from) / from) * 100,
        });
      }
    }
    if (prev && prev.stockStatus !== state.stockStatus) {
      stockChanges.push({
        productId: state.productId,
        name: state.name,
        from: prev.stockStatus,
        to: state.stockStatus,
      });
    }
  }

  const lastDigestAt = previous?.lastDigestAt;
  const alertTargetsHit: DigestResult["alertTargetsHit"] = alerts
    .filter(
      (a) =>
        !a.isActive &&
        a.triggeredAt &&
        (!lastDigestAt || a.triggeredAt >= lastDigestAt),
    )
    .map((a) => {
      const product = watchlist.find((p) => p.id === a.productId);
      return {
        productId: a.productId,
        name: product?.name ?? a.productId,
        price: a.triggeredPrice ?? a.targetPrice,
        currency: a.currency,
      };
    });

  return {
    summary: buildSummary(current),
    priceChanges,
    stockChanges,
    alertTargetsHit,
  };
}

export function formatDigestNotification(result: DigestResult): {
  title: string;
  body: string;
} {
  const { summary } = result;
  const lines: string[] = [];

  const value = formatPrice(summary.totalValue, "USD");
  const counts = [
    `${summary.inStock} in stock`,
    `${summary.backOrder} back-order`,
    `${summary.outOfStock} out of stock`,
  ];
  lines.push(`Watchlist: ${value} · ${counts.join(" · ")}`);

  for (const c of result.priceChanges.slice(0, 3)) {
    const sign = c.percent > 0 ? "+" : "";
    lines.push(
      `${c.name}: ${sign}${c.percent.toFixed(0)}% (${formatPrice(c.from, "USD")} → ${formatPrice(c.to, "USD")})`,
    );
  }
  for (const s of result.stockChanges.slice(0, 3)) {
    lines.push(`${s.name}: ${s.from} → ${s.to}`);
  }
  for (const t of result.alertTargetsHit.slice(0, 3)) {
    lines.push(
      `🎯 ${t.name}: target hit at ${formatPrice(t.price, t.currency)}`,
    );
  }

  if (
    result.priceChanges.length === 0 &&
    result.stockChanges.length === 0 &&
    result.alertTargetsHit.length === 0
  ) {
    lines.push("No changes since your last digest.");
  }

  return {
    title: "📊 Price Digest",
    body: lines.slice(0, 6).join("\n"),
  };
}

export async function maybeSendDigest(
  previous: DigestSnapshot | null,
  watchlist: Product[],
  settings: AppSettings,
  alerts: PriceAlert[],
  send: DigestSender = async (title, body) => {
    const { sendPriceDigestNotification } = await import("./notifications");
    await sendPriceDigestNotification(title, body);
  },
  now = new Date().toISOString(),
): Promise<DigestSnapshot | null> {
  try {
    const frequency = settings.digestFrequency ?? "off";
    if (frequency === "off") return null;

    const intervalMs = frequency === "weekly" ? 7 * 86400000 : 86400000;
    if (previous) {
      const elapsed =
        new Date(now).getTime() - new Date(previous.lastDigestAt).getTime();
      if (elapsed < intervalMs) return null;
    }

    const result = computeDigest(previous, watchlist, settings, alerts);
    const { title, body } = formatDigestNotification(result);
    await send(title, body);

    const displayCurrency = settings.displayCurrency;
    return {
      lastDigestAt: now,
      products: watchlist.map((p) => productState(p, displayCurrency)),
    };
  } catch {
    return null;
  }
}
