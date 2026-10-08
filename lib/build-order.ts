import type { Product } from "./types";
import { getDistributorById } from "@shared/distributors";
import { computeLandedCost, type Destination, type LandedCostOptions } from "./landed-cost";

export interface BuildOrderItem {
  productId: string;
  productName: string;
  distributorId: string;
  itemCost: number;
}

export interface BuildOrderStore {
  distributorId: string;
  distributorName: string;
  items: BuildOrderItem[];
  itemsTotal: number;
  shipping: number;
  total: number;
}

export interface BuildOrderPlan {
  stores: BuildOrderStore[];
  itemsTotal: number;
  shippingTotal: number;
  total: number;
  currency: string;
  unassigned: string[];
}

export interface BuildOrderComparison {
  split: BuildOrderPlan;
  singleStore: BuildOrderPlan | null;
  savings: number;
}

interface Candidate {
  productId: string;
  productName: string;
  distributorId: string;
  distributorName: string;
  itemCost: number;
  shipping: number;
}

function candidatesFor(
  product: Product,
  destination: Destination,
  options: LandedCostOptions,
): Candidate[] {
  const out: Candidate[] = [];
  for (const listing of product.listings ?? []) {
    if (listing.stockStatus !== "in_stock" && listing.stockStatus !== "back_order") continue;
    const distributor = getDistributorById(listing.distributorId);
    if (!distributor) continue;
    const cost = computeLandedCost(listing, distributor, destination, options);
    if (!cost) continue;
    out.push({
      productId: product.id,
      productName: product.name,
      distributorId: listing.distributorId,
      distributorName: distributor.name,
      itemCost: cost.total - cost.shipping,
      shipping: cost.shipping,
    });
  }
  return out;
}

function planFromStores(stores: BuildOrderStore[], currency: string, unassigned: string[]): BuildOrderPlan {
  const itemsTotal = stores.reduce((s, st) => s + st.itemsTotal, 0);
  const shippingTotal = stores.reduce((s, st) => s + st.shipping, 0);
  return { stores, itemsTotal, shippingTotal, total: itemsTotal + shippingTotal, currency, unassigned };
}

export function computeBuildOrder(
  watchlist: Product[],
  destination: Destination,
  options: LandedCostOptions,
): BuildOrderComparison {
  const perProduct = watchlist.map((p) => ({ product: p, candidates: candidatesFor(p, destination, options) }));
  const unassigned = perProduct.filter((e) => e.candidates.length === 0).map((e) => e.product.id);

  const byStore = new Map<string, BuildOrderStore>();
  for (const { candidates } of perProduct) {
    if (candidates.length === 0) continue;
    const best = candidates.reduce((a, b) => (b.itemCost < a.itemCost ? b : a));
    const store = byStore.get(best.distributorId) ?? {
      distributorId: best.distributorId, distributorName: best.distributorName,
      items: [], itemsTotal: 0, shipping: best.shipping, total: 0,
    };
    store.items.push({ productId: best.productId, productName: best.productName, distributorId: best.distributorId, itemCost: best.itemCost });
    store.itemsTotal += best.itemCost;
    byStore.set(best.distributorId, store);
  }
  const splitStores = [...byStore.values()].map((s) => ({ ...s, total: s.itemsTotal + s.shipping }));
  const split = planFromStores(splitStores, destination.currency, unassigned);

  const allDistributorIds = new Set<string>();
  for (const { candidates } of perProduct) for (const c of candidates) allDistributorIds.add(c.distributorId);
  let singleStore: BuildOrderPlan | null = null;
  for (const distributorId of allDistributorIds) {
    const items: BuildOrderItem[] = [];
    let shipping = 0;
    let ok = true;
    for (const { candidates } of perProduct) {
      const here = candidates.filter((c) => c.distributorId === distributorId);
      if (here.length === 0) { ok = false; break; }
      const best = here.reduce((a, b) => (b.itemCost < a.itemCost ? b : a));
      items.push({ productId: best.productId, productName: best.productName, distributorId, itemCost: best.itemCost });
      shipping = best.shipping;
    }
    if (!ok) continue;
    const itemsTotal = items.reduce((s, i) => s + i.itemCost, 0);
    const distributor = getDistributorById(distributorId);
    const plan = planFromStores(
      [{ distributorId, distributorName: distributor?.name ?? distributorId, items, itemsTotal, shipping, total: itemsTotal + shipping }],
      destination.currency, [],
    );
    if (!singleStore || plan.total < singleStore.total) singleStore = plan;
  }

  return { split, singleStore, savings: split.total - (singleStore?.total ?? split.total) };
}
