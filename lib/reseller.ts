import type { Product } from "./types";
import { convertPrice } from "./currency";
import {
  rankByLandedCost,
  type Destination,
  type LandedCostOptions,
} from "./landed-cost";

export interface SourcingLine {
  productId: string;
  productName: string;
  quantity: number;
  buyUnit: number | null;
  spreadMin: number | null;
  spreadMax: number | null;
  sellUnit: number | null;
  marginUnit: number | null;
  marginTotal: number | null;
  currency: string;
}

export interface SourcingSummary {
  lines: SourcingLine[];
  totalMargin: number | null;
  totalOutlay: number;
  currency: string;
}

export function computeSourcing(
  watchlist: Product[],
  destination: Destination,
  options: LandedCostOptions,
): SourcingSummary {
  const currency = destination.currency;
  const lines: SourcingLine[] = watchlist.map((product) => {
    const ranked = rankByLandedCost(product.listings ?? [], destination, {
      ...options,
      category: product.category,
    });
    const buyUnit = ranked.length > 0 ? ranked[0]!.total : null;
    // Spread is over IN-STOCK listings only (an out-of-stock/back-order price is
    // not a live arbitrage signal). rankByLandedCost also admits back_order, so
    // filter the listings to in-stock before ranking for the spread.
    const inStockRanked = rankByLandedCost(
      (product.listings ?? []).filter((l) => l.stockStatus === "in_stock"),
      destination,
      { ...options, category: product.category },
    );
    const spreadMin =
      inStockRanked.length > 0
        ? Math.min(...inStockRanked.map((r) => r.total))
        : null;
    const spreadMax =
      inStockRanked.length > 0
        ? Math.max(...inStockRanked.map((r) => r.total))
        : null;
    const sellUnit =
      product.targetSellPrice != null && Number.isFinite(product.targetSellPrice)
        ? convertPrice(
            product.targetSellPrice,
            product.sellCurrency ?? currency,
            currency,
          )
        : null;
    const quantity =
      product.quantity != null &&
      Number.isFinite(product.quantity) &&
      product.quantity > 0
        ? Math.floor(product.quantity)
        : 1;
    const marginUnit = sellUnit != null && buyUnit != null ? sellUnit - buyUnit : null;
    const marginTotal = marginUnit != null ? marginUnit * quantity : null;
    return {
      productId: product.id,
      productName: product.name,
      quantity,
      buyUnit,
      spreadMin,
      spreadMax,
      sellUnit,
      marginUnit,
      marginTotal,
      currency,
    };
  });
  const withBuy = lines.filter((l) => l.buyUnit != null);
  const totalOutlay = withBuy.reduce((s, l) => s + l.buyUnit! * l.quantity, 0);
  const withMargin = lines.filter((l) => l.marginTotal != null);
  const totalMargin =
    withMargin.length > 0
      ? withMargin.reduce((s, l) => s + l.marginTotal!, 0)
      : null;
  return { lines, totalMargin, totalOutlay, currency };
}
