import { COOKIE_NAME, SESSION_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import { randomUUID, createHash, createHmac } from "crypto";
import bcrypt from "bcryptjs";
import * as db from "../db";

// ─── Signed OAuth state + single-use tickets ────────────────────────────────
// The client must never accept a raw session token from a URL (login CSRF /
// session fixation). Instead the server signs the OAuth `state` envelope and
// issues short-lived, device-bound, single-use tickets that the app redeems.

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_TICKET_TTL_MS = 5 * 60 * 1000;

export interface OAuthStatePayload {
  redirectUri: string;
  deviceId?: string;
  provider: string;
}

const usedStateNonces = new Map<string, number>();

function stateSecret(): string {
  return process.env.JWT_SECRET ?? "dev-secret-change-in-production";
}

function pruneExpiring<K>(map: Map<K, number>, now: number) {
  for (const [key, exp] of map) {
    if (exp <= now) map.delete(key);
  }
  if (map.size > 1000) {
    const oldest = [...map.entries()].sort((a, b) => a[1] - b[1])[0];
    if (oldest) map.delete(oldest[0]);
  }
}

function pruneTickets(now: number) {
  for (const [key, ticket] of oauthTickets) {
    if (ticket.expires <= now) oauthTickets.delete(key);
  }
  if (oauthTickets.size > 1000) {
    const oldest = [...oauthTickets.entries()].sort((a, b) => a[1].expires - b[1].expires)[0];
    if (oldest) oauthTickets.delete(oldest[0]);
  }
}

export function signOAuthState(
  payload: OAuthStatePayload,
  ttlMs: number = OAUTH_STATE_TTL_MS,
): string {
  const body = {
    ...payload,
    nonce: randomUUID(),
    exp: Date.now() + ttlMs,
  };
  const encoded =
    typeof Buffer !== "undefined"
      ? Buffer.from(JSON.stringify(body), "utf8").toString("base64url")
      : btoa(JSON.stringify(body));
  const sig = createHmac("sha256", stateSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyOAuthState(
  state: string,
): (OAuthStatePayload & { nonce: string }) | null {
  try {
    const [encoded, sig] = state.split(".");
    if (!encoded || !sig) return null;
    const expected = createHmac("sha256", stateSecret()).update(encoded).digest("base64url");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return null;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
    if (diff !== 0) return null;
    const body = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as OAuthStatePayload & { nonce?: string; exp?: number };
    if (!body.nonce || typeof body.exp !== "number" || body.exp <= Date.now()) {
      return null;
    }
    if (typeof body.redirectUri !== "string" || typeof body.provider !== "string") {
      return null;
    }
    pruneExpiring(usedStateNonces, Date.now());
    if (usedStateNonces.has(body.nonce)) return null;
    usedStateNonces.set(body.nonce, body.exp);
    return {
      redirectUri: body.redirectUri,
      deviceId: body.deviceId,
      provider: body.provider,
      nonce: body.nonce,
    };
  } catch {
    return null;
  }
}

interface OAuthTicket {
  openId: string;
  deviceId?: string;
  expires: number;
}

const oauthTickets = new Map<string, OAuthTicket>();

function issueOAuthTicket(openId: string, deviceId?: string): string {
  pruneTickets(Date.now());
  const ticket = randomUUID();
  oauthTickets.set(ticket, {
    openId,
    deviceId,
    expires: Date.now() + OAUTH_TICKET_TTL_MS,
  });
  return ticket;
}

function redeemOAuthTicket(
  ticket: string,
  deviceId?: string,
): { openId: string } | null {
  const entry = oauthTickets.get(ticket);
  if (!entry) return null;
  oauthTickets.delete(ticket);
  if (entry.expires <= Date.now()) return null;
  // Device binding kills fixation: a ticket minted for one device cannot be
  // redeemed from another.
  if (entry.deviceId && entry.deviceId !== deviceId) return null;
  return { openId: entry.openId };
}

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
  // Only trust X-Forwarded-For when Express trust proxy is enabled;
  // otherwise a client can spoof its IP and bypass rate limits.
  const trustProxy = (req as unknown as { app?: { get?: (k: string) => unknown } }).app?.get?.("trust proxy");
  if (trustProxy && typeof xf === "string") {
    const forwarded = xf.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  return req.ip ?? "unknown";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function buildUserResponse(user: { id?: number | null; openId?: string | null; name?: string | null; email?: string | null; loginMethod?: string | null; lastSignedIn?: Date | null; emailVerified?: number | boolean | null }) {
  return {
    id: user?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
    emailVerified: Boolean((user as any)?.emailVerified),
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
        maxAge: SESSION_MS,
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
        maxAge: SESSION_MS,
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

  function oauthBases() {
    const apiBase =
      process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
    const webBase =
      process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "") ?? apiBase;
    return {
      apiBase,
      webBase,
      oauthRedirect: `${apiBase || webBase}/api/oauth/callback`,
    };
  }

  function resolveSafeRedirectUri(input: string, webBase: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "/";
    // Relative app paths and the native deep-link scheme are always safe.
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
    if (trimmed.startsWith("productstockfinder:")) return trimmed;
    try {
      const url = new URL(trimmed);
      if (webBase) {
        const base = new URL(webBase);
        if (url.origin === base.origin) return trimmed;
      }
    } catch {
      // fall through to "/"
    }
    return "/";
  }

  function googleOAuthConfig() {
    const clientId =
      process.env.GOOGLE_CLIENT_ID ??
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
      "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
    return {
      configured: clientId.trim().length > 0 && clientSecret.trim().length > 0,
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    };
  }

  function appleOAuthConfig() {
    const clientId =
      process.env.APPLE_CLIENT_ID ?? process.env.EXPO_PUBLIC_APPLE_CLIENT_ID ?? "";
    const teamId = process.env.APPLE_TEAM_ID ?? "";
    const keyId = process.env.APPLE_KEY_ID ?? "";
    const privateKey = process.env.APPLE_PRIVATE_KEY ?? "";
    return {
      configured:
        clientId.trim().length > 0 &&
        teamId.trim().length > 0 &&
        keyId.trim().length > 0 &&
        privateKey.trim().length > 0,
      clientId: clientId.trim(),
      teamId: teamId.trim(),
      keyId: keyId.trim(),
      privateKey,
    };
  }

  async function exchangeGoogleCode(
    code: string,
    redirectUri: string,
  ): Promise<{ sub: string; email: string; name: string } | null> {
    const { clientId, clientSecret } = googleOAuthConfig();
    if (!clientId || !clientSecret) return null;
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      });
      if (!tokenRes.ok) return null;
      const tokenData = (await tokenRes.json()) as { access_token?: string };
      if (!tokenData.access_token) return null;
      const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!userRes.ok) return null;
      const profile = (await userRes.json()) as {
        sub?: string;
        email?: string;
        name?: string;
      };
      if (!profile.sub || !profile.email) return null;
      return { sub: profile.sub, email: profile.email, name: profile.name ?? profile.email };
    } catch {
      return null;
    }
  }

  async function exchangeAppleCode(
    code: string,
  ): Promise<{ sub: string; email: string; name: string } | null> {
    const config = appleOAuthConfig();
    if (!config.configured) return null;
    try {
      const { SignJWT, importPKCS8, jwtVerify, createRemoteJWKSet } = await import("jose");
      const now = Math.floor(Date.now() / 1000);
      const privateKey = await importPKCS8(
        config.privateKey.replace(/\\n/g, "\n"),
        "ES256",
      );
      const clientSecret = await new SignJWT({})
        .setProtectedHeader({ alg: "ES256", kid: config.keyId })
        .setIssuer(config.teamId)
        .setSubject(config.clientId)
        .setAudience("https://appleid.apple.com")
        .setIssuedAt(now)
        .setExpirationTime(now + 300)
        .sign(privateKey);
      const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
        }).toString(),
      });
      if (!tokenRes.ok) return null;
      const tokenData = (await tokenRes.json()) as { id_token?: string };
      if (!tokenData.id_token) return null;
      const jwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
      const { payload } = await jwtVerify(tokenData.id_token, jwks, {
        issuer: "https://appleid.apple.com",
        audience: config.clientId,
      });
      const sub = payload.sub;
      const email = payload.email;
      if (typeof sub !== "string" || typeof email !== "string") return null;
      return { sub, email, name: email };
    } catch {
      return null;
    }
  }

  function errorRedirect(res: Response, message: string) {
    const params = new URLSearchParams({ error: message });
    res.redirect(302, `/oauth/callback?${params.toString()}`);
  }

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    try {
      const providerError =
        typeof req.query.error === "string" ? req.query.error : undefined;
      const rawState = typeof req.query.state === "string" ? req.query.state : "";
      const state = verifyOAuthState(rawState);
      if (!state) {
        errorRedirect(res, "invalid_state");
        return;
      }
      if (providerError) {
        errorRedirect(res, providerError);
        return;
      }
      const code = typeof req.query.code === "string" ? req.query.code : "";
      if (!code) {
        errorRedirect(res, "missing_code");
        return;
      }
      const { oauthRedirect, webBase } = oauthBases();
      const profile =
        state.provider === "apple"
          ? await exchangeAppleCode(code)
          : await exchangeGoogleCode(code, oauthRedirect);
      if (!profile) {
        errorRedirect(res, "exchange_failed");
        return;
      }
      const openId = `${state.provider}:${profile.sub}`;
      await db.upsertUser({
        openId,
        email: profile.email.toLowerCase(),
        name: profile.name,
        loginMethod: state.provider,
        lastSignedIn: new Date(),
      } as never);
      const user = await db.getUserByOpenId(openId);
      if (!user) {
        errorRedirect(res, "provisioning_failed");
        return;
      }
      const sessionToken = await sdk.createSessionToken(openId, {
        name: profile.name,
        deviceId: state.deviceId,
      });
      const isNative =
        Boolean(state.deviceId) ||
        state.redirectUri.startsWith("productstockfinder:");
      if (isNative) {
        const ticket = issueOAuthTicket(openId, state.deviceId);
        const params = new URLSearchParams({ ticket });
        res.redirect(302, `productstockfinder:/oauth/callback?${params.toString()}`);
        return;
      }
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MS });
      res.redirect(302, resolveSafeRedirectUri(state.redirectUri, webBase));
    } catch (error) {
      console.error("[Auth] OAuth callback failed", error);
      errorRedirect(res, "callback_failed");
    }
  });

  app.post("/api/auth/oauth/consume", async (req: Request, res: Response) => {
    try {
      const { ticket, deviceId } = req.body ?? {};
      if (typeof ticket !== "string" || !ticket) {
        res.status(400).json({ error: "ticket is required" });
        return;
      }
      const redeemed = redeemOAuthTicket(
        ticket,
        typeof deviceId === "string" ? deviceId : undefined,
      );
      if (!redeemed) {
        res.status(400).json({ error: "Invalid or expired ticket" });
        return;
      }
      const user = await db.getUserByOpenId(redeemed.openId);
      if (!user) {
        res.status(400).json({ error: "Invalid or expired ticket" });
        return;
      }
      const sessionToken = await sdk.createSessionToken(redeemed.openId, {
        name: user.name ?? "",
        deviceId: typeof deviceId === "string" ? deviceId : undefined,
      });
      res.json({ sessionToken, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] OAuth consume failed", error);
      res.status(400).json({ error: String(error) });
    }
  });

  app.get("/api/auth/oauth/providers", (_req: Request, res: Response) => {
    res.json({
      google: googleOAuthConfig().configured,
      apple: appleOAuthConfig().configured,
    });
  });

  app.get("/api/auth/oauth/start", (req: Request, res: Response) => {
    const provider = String(req.query.provider ?? "").toLowerCase();
    if (!["google", "apple"].includes(provider)) {
      res.status(400).json({ error: "invalid provider; expected google or apple" });
      return;
    }
    const redirectUri =
      typeof req.query.redirectUri === "string" && req.query.redirectUri
        ? String(req.query.redirectUri)
        : undefined;
    const deviceId =
      typeof req.query.deviceId === "string" && req.query.deviceId
        ? String(req.query.deviceId)
        : typeof req.headers["x-device-id"] === "string"
          ? String(req.headers["x-device-id"])
          : undefined;
    const state = signOAuthState({
      redirectUri: redirectUri ?? "",
      deviceId,
      provider,
    });
    const { apiBase, webBase, oauthRedirect } = oauthBases();

    const googleClientId = process.env.GOOGLE_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";
    const appleClientId = process.env.APPLE_CLIENT_ID ?? process.env.EXPO_PUBLIC_APPLE_CLIENT_ID ?? "";

    let url: string;
    if (provider === "google" && googleClientId) {
      const params = new URLSearchParams({
        client_id: googleClientId,
        redirect_uri: oauthRedirect,
        response_type: "code",
        scope: "openid email profile",
        state,
        prompt: "select_account",
      });
      url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } else if (provider === "apple" && appleClientId) {
      const params = new URLSearchParams({
        client_id: appleClientId,
        redirect_uri: oauthRedirect,
        response_type: "code",
        scope: "name email",
        state,
        response_mode: "form_post",
      });
      url = `https://appleid.apple.com/auth/authorize?${params.toString()}`;
    } else {
      const base = apiBase || webBase;
      if (base) {
        url = `${base}/api/oauth/authorize?provider=${encodeURIComponent(provider)}&state=${encodeURIComponent(state)}`;
      } else {
        url = `/api/oauth/authorize?provider=${encodeURIComponent(provider)}&state=${encodeURIComponent(state)}`;
      }
    }
    res.json({ url });
  });

  app.post("/api/auth/forgot", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      if (!checkAuthRateLimit(ip)) {
        res.status(429).json({ error: "Too many requests. Try again shortly." });
        return;
      }
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
        await db.createPasswordResetToken(user.id, hashToken(token), expiresAt);
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
      const ip = getClientIp(req);
      if (!checkAuthRateLimit(ip)) {
        res.status(429).json({ error: "Too many requests. Try again shortly." });
        return;
      }
      const { token, newPassword } = req.body ?? {};
      if (!token || typeof token !== "string" || !token.trim()) {
        res.status(400).json({ error: "token is required" });
        return;
      }
      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
        res.status(400).json({ error: "password must be at least 6 characters" });
        return;
      }
      const tokenHash = hashToken(token.trim());
      const row = await db.getPasswordResetToken(tokenHash);
      if (!row || row.usedAt || (row.expiresAt && row.expiresAt < Date.now())) {
        res.status(400).json({ error: "Invalid or expired token" });
        return;
      }
      const hashFn = (bcrypt as unknown as { hash?: (p: string, r: number) => Promise<string>; default?: { hash: (p: string, r: number) => Promise<string> } }).hash
        ?? (bcrypt as unknown as { default?: { hash: (p: string, r: number) => Promise<string> } }).default?.hash;
      const hashed = hashFn ? await hashFn(newPassword, 10) : await (bcrypt as unknown as { hash: (p: string, r: number) => Promise<string> }).hash(newPassword, 10);
      await db.updateUserPasswordHashById(row.userId, hashed);
      await db.markPasswordResetTokenUsed(tokenHash);
      res.json({ success: true });
    } catch (e: unknown) {
      console.error("[Auth] reset failed", e);
      res.status(400).json({ error: String(e) });
    }
  });

  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const { currentPassword, newPassword } = req.body ?? {};
      if (!currentPassword || typeof currentPassword !== "string" || !currentPassword.trim()) {
        res.status(400).json({ error: "currentPassword is required" });
        return;
      }
      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
        res.status(400).json({ error: "password must be at least 6 characters" });
        return;
      }
      const full = await db.getUserById(user.id);
      if (!full || !full.passwordHash) {
        res.status(400).json({ error: "No password set for this account" });
        return;
      }
      const compareFn = (bcrypt as unknown as { compare?: (p: string, h: string) => Promise<boolean>; default?: { compare: (p: string, h: string) => Promise<boolean> } }).compare
        ?? (bcrypt as unknown as { default?: { compare: (p: string, h: string) => Promise<boolean> } }).default?.compare;
      const valid = compareFn ? await compareFn(currentPassword, full.passwordHash) : await (bcrypt as unknown as { compare: (p: string, h: string) => Promise<boolean> }).compare(currentPassword, full.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Current password is incorrect" });
        return;
      }
      const hashFn = (bcrypt as unknown as { hash?: (p: string, r: number) => Promise<string>; default?: { hash: (p: string, r: number) => Promise<string> } }).hash
        ?? (bcrypt as unknown as { default?: { hash: (p: string, r: number) => Promise<string> } }).default?.hash;
      const hashed = hashFn ? await hashFn(newPassword, 10) : await (bcrypt as unknown as { hash: (p: string, r: number) => Promise<string> }).hash(newPassword, 10);
      await db.updateUserPasswordHashById(user.id, hashed);
      res.json({ success: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Invalid session") || msg.includes("User not found")) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      console.error("[Auth] change-password failed", e);
      res.status(400).json({ error: msg });
    }
  });

  app.post("/api/auth/delete-account", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const { confirm } = req.body ?? {};
      if (confirm !== "DELETE") {
        res.status(400).json({ error: 'confirm must be "DELETE"' });
        return;
      }
      await db.deleteUserById(user.id);
      const cookieOptions = getSessionCookieOptions(req);
      res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      res.json({ success: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Invalid session") || msg.includes("User not found")) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      console.error("[Auth] delete-account failed", e);
      res.status(400).json({ error: msg });
    }
  });

  app.post("/api/auth/resend-verification", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      if (!checkAuthRateLimit(ip)) {
        res.status(429).json({ error: "Too many requests. Try again shortly." });
        return;
      }
      const user = await sdk.authenticateRequest(req);
      if ((user as any).emailVerified) {
        res.json({ success: true, alreadyVerified: true });
        return;
      }
      const email = (user as any).email ?? "";
      const token = randomUUID();
      const expiresAt = Date.now() + PASSWORD_RESET_TTL_MS;
      await db.createEmailVerificationToken(user.id, hashToken(token), expiresAt);
      const baseUrl = process.env.EXPO_PUBLIC_WEB_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
      const verifyLink = baseUrl ? `${baseUrl.replace(/\/$/, "")}/verify?token=${token}&email=${encodeURIComponent(email)}` : `token=${token}`;
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        console.log(`[EmailVerify] Sending verification email to ${email}: ${verifyLink}`);
      } else {
        console.log(`[EmailVerify] No SMTP configured — verification link for ${email}: ${verifyLink} (token=${token})`);
      }
      res.json({ success: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Invalid session") || msg.includes("User not found")) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      console.error("[Auth] resend-verification failed", e);
      res.status(400).json({ error: msg });
    }
  });

  app.post("/api/auth/verify", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      if (!checkAuthRateLimit(ip)) {
        res.status(429).json({ error: "Too many requests. Try again shortly." });
        return;
      }
      const { token } = req.body ?? {};
      if (!token || typeof token !== "string" || !token.trim()) {
        res.status(400).json({ error: "token is required" });
        return;
      }
      const tokenHash = hashToken(token.trim());
      const row = await db.getEmailVerificationToken(tokenHash);
      if (!row || row.usedAt || (row.expiresAt && row.expiresAt < Date.now())) {
        res.status(400).json({ error: "Invalid or expired token" });
        return;
      }
      await db.setUserEmailVerified(row.userId);
      await db.markEmailVerificationTokenUsed(tokenHash);
      res.json({ success: true });
    } catch (e: unknown) {
      console.error("[Auth] verify failed", e);
      res.status(400).json({ error: String(e) });
    }
  });
}
