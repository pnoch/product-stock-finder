import type { Distributor } from "@shared/types";
import type { DistributorListing } from "../../../../lib/types";

export type CompareListing = DistributorListing & {
  distName: string;
  dist: Distributor | undefined;
};

export type PriceTrend = { pct: number; dir: "up" | "down" | "flat" };
