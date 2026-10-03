import { z } from "zod";
import { MAX_UPLOAD_HISTORY_POINTS } from "../../shared/const.js";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getPrice } from "../prices";
import { PRODUCT_CATALOG } from "../../shared/src/catalog.js";
import { getAllParserIds } from "../../lib/scrapers/registry";
import { mergeHistory } from "../price-history";
import { checkRateLimit } from "../rate-limit";

export const pricesRouter = router({
  get: publicProcedure
    .input(
      z.object({
        distributorId: z.string().min(1).max(64),
        modelNumber: z.string().min(1).max(128),
      }),
    )
    .query(async ({ ctx, input }) => {
      checkRateLimit(ctx, "prices.get", 60, 60_000);
      return getPrice(input.distributorId, input.modelNumber);
    }),
  uploadHistory: protectedProcedure
    .input(
      z.object({
        // Must be a registered parser id and a catalog model: otherwise any
        // signed-in user can create orphaned rows for arbitrary keys.
        distributorId: z.string().min(1).max(64).refine(
          (v) => getAllParserIds().includes(v),
          "unknown distributor",
        ),
        modelNumber: z.string().min(1).max(128).refine(
          (v) => PRODUCT_CATALOG.some((p) => p.modelNumber === v),
          "unknown model",
        ),
        points: z
          .array(
            z.object({
              // Must be a strict ISO-8601 UTC instant: the column is a
              // varchar(10) day key compared lexicographically, and a
              // future-dated point would win every LWW merge forever
              // (purgeOldHistory only removes past rows).
              date: z
                .string()
                .regex(
                  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/,
                  "date must be an ISO-8601 UTC timestamp",
                )
                .refine(
                  (v) => {
                    const t = Date.parse(v);
                    // One hour of tolerance for client clock skew: a whole day
                    // let a point dated "tomorrow" (or later today) win that
                    // day's LWW merge and outlive the purge.
                    return !Number.isNaN(t) && t <= Date.now() + 3_600_000;
                  },
                  "date must not be more than an hour in the future",
                ),
              // decimal(12,4) — a larger value fails the insert with a 500.
              price: z.number().finite().positive().max(99_999_999),
              currency: z.string().min(1).max(8),
              stockStatus: z.enum([
                "in_stock",
                "back_order",
                "out_of_stock",
                "unknown",
              ]),
            }),
          )
          .max(MAX_UPLOAD_HISTORY_POINTS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      checkRateLimit(ctx, "prices.uploadHistory", 30, 60_000);
      // History is global per distributor/model; writes are protected to
      // prevent anonymous pollution. No per-user ownership check needed.
      void ctx.user.id;
      await mergeHistory(
        input.distributorId,
        input.modelNumber,
        input.points,
      );
      return { accepted: input.points.length } as const;
    }),
});
