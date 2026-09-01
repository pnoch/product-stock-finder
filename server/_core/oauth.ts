import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";

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
}
