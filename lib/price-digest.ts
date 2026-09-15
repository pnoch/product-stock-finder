import { formatPrice } from "@shared/currency";
import { getBestPrice } from "./currency";
import { isInQuietHours } from "./quiet-hours";
import type { AppSettings, PriceAlert, Product, StockStatus } from "./types";

export interface DigestProductState {
  productId: string;
  name: string;
  bestPrice: number | null;
  stockStatus: StockStatus;
}

export interface DigestSnapshot {
  lastDigestAt: string;
  // Currency the snapshot's bestPrice values were converted to; price deltas
  // are only comparable against snapshots in the same unit.
  displayCurrency?: string;
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
  // Currency all summary/priceChange amounts are denominated in.
  displayCurrency?: string;
  valueDelta: { from: number; to: number; percent: number } | null;
  newProducts: { productId: string; name: string }[];
  removedProducts: { productId: string; name: string }[];
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

export type DigestSender = (title: string, body: string) => Promise<boolean>;

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
      : product.listings.length === 0 ||
          product.listings.some((l) => l.stockStatus === "unknown")
        ? "unknown"
        : "out_of_stock";
  return {
    productId: product.id,
    name: product.name,
    bestPrice: best?.price ?? null,
    stockStatus,
  };
}

export function buildDigestSnapshot(
  products: Product[],
  displayCurrency: string,
  now: string = new Date().toISOString(),
): DigestSnapshot {
  return {
    lastDigestAt: now,
    displayCurrency,
    products: products.map((p) => productState(p, displayCurrency)),
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
  // Legacy snapshots predate currency stamping; only trust the guard when the
  // snapshot explicitly declares a different unit.
  const currencyChanged =
    previous?.displayCurrency != null &&
    previous.displayCurrency !== displayCurrency;

  const priceChanges: DigestResult["priceChanges"] = [];
  const stockChanges: DigestResult["stockChanges"] = [];

  for (const state of current) {
    const prev = prevMap.get(state.productId);
    if (
      !currencyChanged &&
      prev &&
      prev.bestPrice != null &&
      state.bestPrice != null
    ) {
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

  const summary = buildSummary(current);
  const prevSummary = buildSummary(previous?.products ?? []);
  const valueDelta =
    previous &&
    !currencyChanged &&
    prevSummary.totalValue > 0 &&
    summary.totalValue > 0
      ? {
          from: prevSummary.totalValue,
          to: summary.totalValue,
          percent:
            ((summary.totalValue - prevSummary.totalValue) /
              prevSummary.totalValue) *
            100,
        }
      : null;

  const prevIds = new Set((previous?.products ?? []).map((p) => p.productId));
  const currentIds = new Set(current.map((p) => p.productId));
  const newProducts = current
    .filter((p) => !prevIds.has(p.productId))
    .map((p) => ({ productId: p.productId, name: p.name }));
  const removedProducts = (previous?.products ?? [])
    .filter((p) => !currentIds.has(p.productId))
    .map((p) => ({ productId: p.productId, name: p.name }));

  priceChanges.sort((a, b) => Math.abs(b.percent) - Math.abs(a.percent));

  return {
    summary,
    displayCurrency,
    valueDelta,
    newProducts,
    removedProducts,
    priceChanges,
    stockChanges,
    alertTargetsHit,
  };
}

export function formatDigestNotification(result: DigestResult): {
  title: string;
  body: string;
} {
  const { summary, valueDelta } = result;
  const currency = result.displayCurrency ?? "USD";
  const lines: string[] = [];

  if (valueDelta) {
    const sign = valueDelta.percent >= 0 ? "+" : "";
    lines.push(
      `Watchlist value ${formatPrice(valueDelta.from, currency)} → ${formatPrice(valueDelta.to, currency)} (${sign}${valueDelta.percent.toFixed(1)}%)`,
    );
  } else {
    lines.push(`Watchlist: ${formatPrice(summary.totalValue, currency)}`);
  }
  lines.push(
    `${summary.inStock} in stock · ${summary.backOrder} back-order · ${summary.outOfStock} out of stock`,
  );

  for (const c of result.priceChanges.slice(0, 3)) {
    const sign = c.percent > 0 ? "+" : "";
    lines.push(
      `${c.name}: ${sign}${c.percent.toFixed(0)}% (${formatPrice(c.from, currency)} → ${formatPrice(c.to, currency)})`,
    );
  }
  for (const s of result.stockChanges.slice(0, 2)) {
    lines.push(`${s.name}: ${s.from} → ${s.to}`);
  }
  for (const t of result.alertTargetsHit.slice(0, 2)) {
    lines.push(
      `🎯 ${t.name}: target hit at ${formatPrice(t.price, t.currency)}`,
    );
  }
  if (result.newProducts.length > 0)
    lines.push(`➕ ${result.newProducts.length} product(s) added`);
  if (result.removedProducts.length > 0)
    lines.push(`➖ ${result.removedProducts.length} product(s) removed`);

  if (
    result.priceChanges.length === 0 &&
    result.stockChanges.length === 0 &&
    result.alertTargetsHit.length === 0 &&
    result.newProducts.length === 0 &&
    result.removedProducts.length === 0
  ) {
    lines.push("No changes since your last digest.");
  }

  return {
    title: "📊 Price Digest",
    body: lines.slice(0, 9).join("\n"),
  };
}

export async function maybeSendDigest(
  previous: DigestSnapshot | null,
  watchlist: Product[],
  settings: AppSettings,
  alerts: PriceAlert[],
  send: DigestSender = async (title, body) => {
    const { sendPriceDigestNotification } = await import("./notifications");
    return sendPriceDigestNotification(title, body);
  },
  now = new Date().toISOString(),
): Promise<DigestSnapshot | null> {
  try {
    const frequency = settings.digestFrequency ?? "off";
    if (frequency === "off") return null;

    // Respect quiet hours: defer digest until the window ends, so it groups
    // with other alerts and doesn't wake the user. Next tick will retry.
    if (isInQuietHours(settings, new Date(now))) return null;

    const intervalMs = frequency === "weekly" ? 7 * 86400000 : 86400000;
    if (previous) {
      const lastTime = new Date(previous.lastDigestAt).getTime();
      const nowTime = new Date(now).getTime();
      if (!Number.isNaN(lastTime) && !Number.isNaN(nowTime)) {
        if (frequency === "weekly") {
          const targetDay = settings.digestDayOfWeek ?? 0;
          if (new Date(now).getDay() !== targetDay) return null;
          const lastDay = new Date(lastTime);
          lastDay.setHours(0, 0, 0, 0);
          const nowDay = new Date(nowTime);
          nowDay.setHours(0, 0, 0, 0);
          const daysDiff = Math.floor((nowDay.getTime() - lastDay.getTime()) / 86400000);
          if (daysDiff < 7) return null;
        } else {
          const nextEligible = lastTime + intervalMs;
          if (nowTime < nextEligible) return null;
        }
      } else if (Number.isNaN(lastTime)) {
        // Invalid lastDigestAt — skip interval check but still respect weekly day gate
        if (
          frequency === "weekly" &&
          new Date(now).getDay() !== (settings.digestDayOfWeek ?? 0)
        ) {
          return null;
        }
      }
    }

    const result = computeDigest(previous, watchlist, settings, alerts);
    const { title, body } = formatDigestNotification(result);
    // Do not advance the snapshot when nothing was delivered (permission
    // denied, web, quiet hours): advancing would delay the next digest a full
    // interval even though the user never saw this one.
    const delivered = await send(title, body);
    if (!delivered) return null;

    const displayCurrency = settings.displayCurrency;
    return buildDigestSnapshot(watchlist, displayCurrency, now);
  } catch {
    return null;
  }
}
