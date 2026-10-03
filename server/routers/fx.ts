import { router, publicProcedure } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";
import { getFxRates } from "../fx";

export const fxRouter = router({
  get: publicProcedure.query(async ({ ctx }) => {
    checkRateLimit(ctx, "fx.get", 60, 60_000);
    return getFxRates();
  }),
});
