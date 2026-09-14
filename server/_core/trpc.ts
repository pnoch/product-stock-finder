import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

// tRPC's default error shape forwards the thrown error's message verbatim, so
// an unexpected throw (a DB driver error, a connection string) would reach the
// client — and the UI surfaces `error.message` directly. Deliberate TRPCErrors
// carry no `cause`; anything with a cause is an unhandled internal error and is
// replaced with a generic message. The real error is still logged server-side.
export const GENERIC_ERR_MSG = "Something went wrong. Please try again.";

export function redactErrorShape<T extends { message: string }>(
  shape: T,
  error: { cause?: unknown },
): T {
  if (error.cause === undefined) return shape;
  return { ...shape, message: GENERIC_ERR_MSG };
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return redactErrorShape(shape, error);
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = protectedProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
