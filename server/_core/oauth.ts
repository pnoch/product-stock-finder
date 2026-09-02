import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import * as db from "../db";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
function sendPasswordResetEmail(email: string, token: string) {
  const baseUrl = process.env.EXPO_PUBLIC_WEB_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
  const resetLink = baseUrl ? `${baseUrl.replace(/\/$/, "")}/reset?token=${token}` : `token=${token}`;
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    console.log(`[PasswordReset] Sending reset email to ${email}: ${resetLink}`);
  } else {
    console.log(`[PasswordReset] No SMTP configured — reset link for ${email}: ${resetLink} (token=${token})`);
  }
}
const authBuckets = new Map<string, number[]>();
const AUTH_RATE_LIMIT = 10;
const AUTH_RATE_WINDOW = 60_000;

function checkAuthRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - AUTH_RATE_WINDOW;
  const timestamps = authBuckets.get(ip) ?? [];
  const recent = timestamps.filter((t) => t > windowStart);
  if (recent.length >= AUTH_RATE_LIMIT) {
    authBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  authBuckets.set(ip, recent);
  // prune stale buckets to bound memory
  if (authBuckets.size > 500) {
    for (const [k, v] of authBuckets.entries()) {
      if (v.length === 0 || v.every((t) => t <= windowStart)) authBuckets.delete(k);
      if (authBuckets.size <= 300) break;
    }
  }
  return true;
}

function getClientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  const forwarded = typeof xf === "string" ? xf.split(",")[0]?.trim() : undefined;
  return forwarded ?? req.ip ?? "unknown";
}

function buildUserResponse(user: { id?: number | null; openId?: string | null; name?: string | null; email?: string | null; loginMethod?: string | null; lastSignedIn?: Date | null }) {
  return {
    id: user?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
  };
}

export function registerOAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      if (!checkAuthRateLimit(ip)) {
        res.status(429).json({ error: "Too many requests. Try again shortly." });
        return;
      }
      const { email, password, name } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "email and password are required" });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: "password must be at least 6 characters" });
        return;
      }

      const result = await sdk.register({ email, password, name });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, result.sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });
      res.json({ user: buildUserResponse(result.user), sessionToken: result.sessionToken });
    } catch (error: any) {
      console.error("[Auth] Register failed:", error);
      res.status(400).json({ error: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      if (!checkAuthRateLimit(ip)) {
        res.status(429).json({ error: "Too many requests. Try again shortly." });
        return;
      }
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "email and password are required" });
        return;
      }

      const result = await sdk.login({ email, password });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, result.sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });
      res.json({ user: buildUserResponse(result.user), sessionToken: result.sessionToken });
    } catch (error: any) {
      console.error("[Auth] Login failed:", error);
      res.status(401).json({ error: error.message || "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/me failed:", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect(302, "/");
  });

  app.post("/api/auth/forgot", async (req: Request, res: Response) => {
    try {
      const { email } = req.body ?? {};
      if (!email || typeof email !== "string" || !email.trim()) {
        res.status(400).json({ error: "email is required" });
        return;
      }
      const normalized = String(email).trim().toLowerCase();
      const user = await db.getUserByEmail(normalized);
      if (user?.id) {
        const token = randomUUID();
        const expiresAt = Date.now() + PASSWORD_RESET_TTL_MS;
        await db.createPasswordResetToken(user.id, token, expiresAt);
        sendPasswordResetEmail(normalized, token);
      }
      res.json({ success: true });
    } catch (e: unknown) {
      console.error("[Auth] forgot failed", e);
      res.status(400).json({ error: String(e) });
    }
  });

  app.post("/api/auth/reset", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body ?? {};
      if (!token || typeof token !== "string" || !token.trim()) {
        res.status(400).json({ error: "token is required" });
        return;
      }
      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
        res.status(400).json({ error: "password must be at least 6 characters" });
        return;
      }
      const row = await db.getPasswordResetToken(token);
      if (!row || row.usedAt || (row.expiresAt && row.expiresAt < Date.now())) {
        res.status(400).json({ error: "Invalid or expired token" });
        return;
      }
      const hashFn = (bcrypt as unknown as { hash?: (p: string, r: number) => Promise<string>; default?: { hash: (p: string, r: number) => Promise<string> } }).hash
        ?? (bcrypt as unknown as { default?: { hash: (p: string, r: number) => Promise<string> } }).default?.hash;
      const hashed = hashFn ? await hashFn(newPassword, 10) : await (bcrypt as unknown as { hash: (p: string, r: number) => Promise<string> }).hash(newPassword, 10);
      await db.updateUserPasswordHashById(row.userId, hashed);
      await db.markPasswordResetTokenUsed(token);
      res.json({ success: true });
    } catch (e: unknown) {
      console.error("[Auth] reset failed", e);
      res.status(400).json({ error: String(e) });
    }
  });
}
