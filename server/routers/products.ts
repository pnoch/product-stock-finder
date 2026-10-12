import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";
import { parseProductText } from "../product-parse";
import { resolveMarketplaceLink } from "../marketplace-resolver";
import { MAX_MARKETPLACE_URL_LENGTH } from "../../shared/const";
import { tryConsumeBudget } from "../spend-budget";

export const productsRouter = router({
  resolveMarketplace: publicProcedure
    .input(z.object({ url: z.string().min(1).max(MAX_MARKETPLACE_URL_LENGTH) }))
    .query(async ({ ctx, input }) => {
      checkRateLimit(ctx, "products.resolveMarketplace", 10, 60_000);
      if (!tryConsumeBudget("products.parseUrl")) return { kind: "error", reason: "network" } as const;
      return resolveMarketplaceLink(input.url);
    }),
  parse: publicProcedure
    .input(z.object({ raw: z.string().min(1).max(2000) }))
    .query(async ({ ctx, input }) => {
      checkRateLimit(ctx, "products.parse", 10, 60_000);
      return { product: await parseProductText(input.raw) };
    }),
});
