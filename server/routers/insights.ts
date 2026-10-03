import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";
import { userLlmConfigFromHeaders } from "../user-llm";
import { getInsight } from "../price-insights";

export const insightsRouter = router({
  get: publicProcedure
    .input(z.object({ productId: z.string().min(1).max(191) }))
    .query(async ({ ctx, input }) => {
      checkRateLimit(ctx, "insights.get", 30, 60_000);
      return getInsight(input.productId, userLlmConfigFromHeaders(ctx.req.headers));
    }),
});
