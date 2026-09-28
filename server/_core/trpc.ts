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
  // tRPC's default formatter attaches `data.stack` unless NODE_ENV is exactly
  // "production" — and this server is routinely run without NODE_ENV, so the
  // stack (validation internals, file paths) reached the client. Strip it
  // unconditionally; the real error is still logged server-side.
  const withData = shape as T & { data?: Record<string, unknown> };
  const redacted: T = withData.data
    ? ({
        ...withData,
        data: Object.fromEntries(
          Object.entries(withData.data).filter(([key]) => key !== "stack"),
        ),
      } as T)
    : shape;
  if (error.cause === undefined) return redacted;
  return { ...redacted, message: GENERIC_ERR_MSG };
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
