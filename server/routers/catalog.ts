import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { PRICE_SNAPSHOT_TTL_MS } from "../../shared/const";
import { PRODUCT_CATALOG } from "../../shared/src/catalog.js";
import { listCachedInStock } from "../price-cache";
import { groupAvailable } from "../available";

export const catalogRouter = router({
  available: publicProcedure
    .input(
      z
        .object({
          currency: z.string().max(8).default("USD"),
          category: z.string().max(64).optional(),
          brand: z.string().max(64).optional(),
          maxPrice: z.number().positive().optional(),
        })
        .default({ currency: "USD" }),
    )
    .query(async ({ input }) => {
      const rows = await listCachedInStock(Date.now(), PRICE_SNAPSHOT_TTL_MS);
      let out = groupAvailable(rows, PRODUCT_CATALOG, input.currency);
      if (input.category) out = out.filter((r) => r.category === input.category);
      if (input.brand) out = out.filter((r) => r.brand === input.brand);
      if (input.maxPrice != null) out = out.filter((r) => r.bestPrice <= input.maxPrice!);
      return out.slice(0, 100);
    }),
});
