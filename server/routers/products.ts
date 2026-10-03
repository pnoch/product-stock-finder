import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";
import { parseProductText } from "../product-parse";

export const productsRouter = router({
  parse: publicProcedure
    .input(z.object({ raw: z.string().min(1).max(2000) }))
    .query(async ({ ctx, input }) => {
      checkRateLimit(ctx, "products.parse", 10, 60_000);
      return { product: await parseProductText(input.raw) };
    }),
});
