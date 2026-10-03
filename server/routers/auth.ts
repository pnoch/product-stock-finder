import { z } from "zod";
import { COOKIE_NAME } from "../../shared/const.js";
import { getSessionCookieOptions } from "../_core/cookies";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";

export const authRouter = router({
  // Never return the raw user row: it carries passwordHash, openId, and role.
  // Mirrors the REST /api/auth/me shape.
  me: publicProcedure.query((opts) => {
    const user = opts.ctx.user;
    if (!user) return null;
    return {
      id: user.id ?? null,
      openId: user.openId ?? null,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      lastSignedIn: user.lastSignedIn
        ? new Date(user.lastSignedIn).toISOString()
        : null,
      emailVerified: Boolean((user as { emailVerified?: unknown }).emailVerified),
    };
  }),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return {
      success: true,
    } as const;
  }),
  deleteAccount: protectedProcedure
    // Same destructive-action guard as the REST endpoint: an accidental or
    // CSRF-driven call must not delete the account.
    .input(z.object({ confirm: z.literal("DELETE") }))
    .mutation(async ({ ctx }) => {
    checkRateLimit(ctx, "auth.deleteAccount", 5, 60_000);
    const { deleteUserById } = await import("../db.js");
    await deleteUserById(ctx.user.id);
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});
