import { COOKIE_NAME, SESSION_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import { randomUUID, createHash, createHmac } from "crypto";
import bcrypt from "bcryptjs";
import * as db from "../db";
import { isDeviceRevoked, unrevokeDevice } from "../devices";
import { sendEmail } from "../email";
import { HttpError } from "../../shared/_core/errors.js";

// Only messages the auth layer deliberately raises (HttpError, e.g. "Invalid
// email or password") are safe to return. Anything else — a DB driver error, a
// bcrypt failure — is logged server-side and replaced with a generic message so
// internals never reach the client.
function safeAuthErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof HttpError && error.message) return error.message;
  return fallback;
}

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
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production")
    throw new Error("JWT_SECRET must be set in production");
  return "dev-secret-change-in-production";
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

function webBaseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "") ||
    process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    ""
  );
}

async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const base = webBaseUrl();
  const link = base ? `${base}/reset-password?token=${encodeURIComponent(token)}` : "";
  await sendEmail({
    to: email,
    subject: "Reset your Product Stock Finder password",
    text:
      `We received a request to reset your password.\n\n` +
      (link
        ? `Reset it here (expires in 1 hour): ${link}\n\n`
        : `Open the app and use this reset token (expires in 1 hour): ${token}\n\n`) +
      `If you did not request this, you can ignore this email.`,
    html:
      `<p>We received a request to reset your password.</p>` +
      (link
        ? `<p><a href="${link}">Reset your password</a> (expires in 1 hour).</p>`
        : `<p>Use this reset token in the app (expires in 1 hour): <code>${token}</code></p>`) +
      `<p>If you did not request this, you can ignore this email.</p>`,
  });
}
const authBuckets = new Map<string, number[]>();
const AUTH_RATE_LIMIT = 10;
const AUTH_RATE_WINDOW = 60_000;

function checkAuthRateLimit(key: string): boolean {
  // Key is usually the client IP; pass a scoped key (e.g. `forgot:<email>`)
  // for per-target buckets. An attacker rotating source addresses still
  // hits the per-target budget.
  const now = Date.now();
  const windowStart = now - AUTH_RATE_WINDOW;
  const timestamps = authBuckets.get(key) ?? [];
  const recent = timestamps.filter((t) => t > windowStart);
  if (recent.length >= AUTH_RATE_LIMIT) {
    authBuckets.set(key, recent);
    return false;
  }
  recent.push(now);
  authBuckets.set(key, recent);
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
  // Express resolves `req.ip` from the socket address, and — only when
  // `trust proxy` is configured — from X-Forwarded-For, taking the address
  // added by the trusted hop. Reading the raw leftmost XFF entry here would
  // let a client spoof its own key and bypass every auth rate limit.
  return req.ip ?? "unknown";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function deviceIdFromReq(req: Request): string | null {
  const raw = req.headers["x-device-id"];
  return typeof raw === "string" && raw ? raw : null;
}

// Revoked devices must not reach account mutations even though they present
// a technically valid session (tRPC checks this in createContext; REST must
// check it here).
async function assertDeviceAllowed(
  res: Response,
  userId: number,
  deviceId: string | null,
): Promise<boolean> {
  if (deviceId && (await isDeviceRevoked(userId, deviceId))) {
    res.status(403).json({ error: "Device revoked" });
    return false;
  }
  return true;
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

      const result = await sdk.register({
        email,
        password,
        name,
        deviceId: deviceIdFromReq(req) ?? undefined,
      });
      // A fresh login from a previously signed-out device re-authorizes it.
      const registerDeviceId = deviceIdFromReq(req);
      if (registerDeviceId) {
        await unrevokeDevice(result.user.id, registerDeviceId);
      }
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, result.sessionToken, {
        ...cookieOptions,
        maxAge: SESSION_MS,
      });
      res.json({ user: buildUserResponse(result.user), sessionToken: result.sessionToken });
    } catch (error: any) {
      console.error("[Auth] Register failed:", error);
      res
        .status(400)
        .json({ error: safeAuthErrorMessage(error, "Registration failed") });
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

      const result = await sdk.login({
        email,
        password,
        deviceId: deviceIdFromReq(req) ?? undefined,
      });
      // A fresh login from a previously signed-out device re-authorizes it.
      const loginDeviceId = deviceIdFromReq(req);
      if (loginDeviceId) {
        await unrevokeDevice(result.user.id, loginDeviceId);
      }
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, result.sessionToken, {
        ...cookieOptions,
        maxAge: SESSION_MS,
      });
      res.json({ user: buildUserResponse(result.user), sessionToken: result.sessionToken });
    } catch (error: any) {
      console.error("[Auth] Login failed:", error);
      res
        .status(401)
        .json({ error: safeAuthErrorMessage(error, "Login failed") });
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
    // Reject backslash-prefixed paths: browsers treat "\" as "/" for special
    // schemes, so "/\evil.com" resolves to https://evil.com (open redirect).
    if (
      trimmed.startsWith("/") &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("/\\")
    ) {
      return trimmed;
    }
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
  ): Promise<{ sub: string; email: string; name: string; emailVerified: boolean } | null> {
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
        email_verified?: boolean;
      };
      if (!profile.sub || !profile.email) return null;
      return {
        sub: profile.sub,
        email: profile.email,
        name: profile.name ?? profile.email,
        emailVerified: profile.email_verified === true,
      };
    } catch {
      return null;
    }
  }

  async function exchangeAppleCode(
    code: string,
  ): Promise<{ sub: string; email: string; name: string; emailVerified: boolean } | null> {
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
      return {
        sub,
        email,
        name: email,
        // Apple sends email_verified as a string ("true") or boolean.
        emailVerified:
          payload.email_verified === true || payload.email_verified === "true",
      };
    } catch {
      return null;
    }
  }

  function errorRedirect(res: Response, message: string) {
    const params = new URLSearchParams({ error: message });
    res.redirect(302, `/oauth/callback?${params.toString()}`);
  }

  // Apple uses response_mode=form_post, so the authorization response arrives
  // as a POST body; Google uses a GET query. Accept both with one handler.
  const oauthCallbackHandler = async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      if (!checkAuthRateLimit(ip)) {
        errorRedirect(res, "rate_limited");
        return;
      }
      const src = { ...(req.query as Record<string, unknown>), ...(req.body as Record<string, unknown> ?? {}) };
      const pick = (k: string): string | undefined =>
        typeof src[k] === "string" ? (src[k] as string) : undefined;
      const providerError = pick("error");
      const rawState = pick("state") ?? "";
      const state = verifyOAuthState(rawState);
      if (!state) {
        errorRedirect(res, "invalid_state");
        return;
      }
      if (providerError) {
        errorRedirect(res, providerError);
        return;
      }
      const code = pick("code") ?? "";
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
      // If an account already exists for this email (e.g. registered with a
      // password), link the OAuth identity to it instead of letting the unique
      // email index silently update the row and leave the old openId.
      const existingByEmail = await db.getUserByEmail(
        profile.email.toLowerCase(),
      );
      // Only link when the provider vouches for the email. Linking on an
      // unverified email lets an attacker pre-register a victim's address and
      // then share the account once the victim signs in with OAuth.
      if (
        existingByEmail &&
        existingByEmail.openId !== openId &&
        profile.emailVerified
      ) {
        await db.linkUserOpenIdByEmail(
          profile.email.toLowerCase(),
          openId,
        );
      } else if (existingByEmail && existingByEmail.openId !== openId) {
        // Unverified email collides with an existing account: refuse rather
        // than silently creating a second row that violates the unique index.
        errorRedirect(res, "email_in_use");
        return;
      }
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
        const safeRedirect = resolveSafeRedirectUri(state.redirectUri, webBase);
        if (safeRedirect.startsWith("http://") || safeRedirect.startsWith("https://")) {
          const sep = safeRedirect.includes("?") ? "&" : "?";
          res.redirect(302, `${safeRedirect}${sep}ticket=${encodeURIComponent(ticket)}`);
          return;
        }
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
  };
  app.get("/api/oauth/callback", oauthCallbackHandler);
  app.post("/api/oauth/callback", oauthCallbackHandler);

  app.post("/api/auth/oauth/consume", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      if (!checkAuthRateLimit(ip)) {
        res.status(429).json({ error: "Too many requests. Try again shortly." });
        return;
      }
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
      res
        .status(400)
        .json({ error: safeAuthErrorMessage(error, "Sign-in failed") });
    }
  });

  app.get("/api/auth/oauth/providers", (req: Request, res: Response) => {
    if (!checkAuthRateLimit(getClientIp(req))) {
      res.status(429).json({ error: "Too many requests. Try again shortly." });
      return;
    }
    res.json({
      google: googleOAuthConfig().configured,
      apple: appleOAuthConfig().configured,
    });
  });

  app.get("/api/auth/oauth/start", (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!checkAuthRateLimit(ip)) {
      res.status(429).json({ error: "Too many requests. Try again shortly." });
      return;
    }
    const provider = String(req.query.provider ?? "").toLowerCase();
    if (!["google", "apple"].includes(provider)) {
      res.status(400).json({ error: "invalid provider; expected google or apple" });
      return;
    }
    const { webBase } = oauthBases();
    // Sanitize before signing: the state envelope must never carry an
    // attacker-controlled redirect target, even though the callback
    // re-validates on use (defense in depth).
    const rawRedirectUri =
      typeof req.query.redirectUri === "string" && req.query.redirectUri
        ? String(req.query.redirectUri)
        : "";
    const redirectUri = resolveSafeRedirectUri(rawRedirectUri, webBase);
    const deviceId =
      typeof req.query.deviceId === "string" && req.query.deviceId
        ? String(req.query.deviceId)
        : typeof req.headers["x-device-id"] === "string"
          ? String(req.headers["x-device-id"])
          : undefined;
    const state = signOAuthState({
      redirectUri,
      deviceId,
      provider,
    });
    const { apiBase, oauthRedirect } = oauthBases();

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
      // Per-target bucket in addition to the per-IP one above: rotating
      // source addresses must not allow bombing one victim's inbox.
      if (!checkAuthRateLimit(`forgot:${normalized}`)) {
        res.status(429).json({ error: "Too many requests. Try again shortly." });
        return;
      }
      const user = await db.getUserByEmail(normalized);
      if (user?.id) {
        const token = randomUUID();
        const expiresAt = Date.now() + PASSWORD_RESET_TTL_MS;
        await db.createPasswordResetToken(user.id, hashToken(token), expiresAt);
        // Send the plaintext token only over email; the DB stores its hash.
        await sendPasswordResetEmail(normalized, token);
      }
      res.json({ success: true });
    } catch (e: unknown) {
      console.error("[Auth] forgot failed", e);
      res
        .status(400)
        .json({ error: safeAuthErrorMessage(e, "Request failed. Please try again.") });
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
      const hashFn = (bcrypt as unknown as { hash?: (p: string, r: number) => Promise<string>; default?: { hash: (p: string, r: number) => Promise<string> } }).hash
        ?? (bcrypt as unknown as { default?: { hash: (p: string, r: number) => Promise<string> } }).default?.hash;
      const hashed = hashFn ? await hashFn(newPassword, 10) : await (bcrypt as unknown as { hash: (p: string, r: number) => Promise<string> }).hash(newPassword, 10);
      // Consume + apply in one transaction: a failure after consumption would
      // otherwise burn the one-time token without changing the password.
      const ok = await db.resetPasswordWithToken(tokenHash, hashed);
      if (!ok) {
        res.status(400).json({ error: "Invalid or expired token" });
        return;
      }
      res.json({ success: true });
    } catch (e: unknown) {
      console.error("[Auth] reset failed", e);
      res
        .status(400)
        .json({ error: safeAuthErrorMessage(e, "Password reset failed") });
    }
  });

  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      if (!checkAuthRateLimit(ip)) {
        res.status(429).json({ error: "Too many requests. Try again shortly." });
        return;
      }
      const user = await sdk.authenticateRequest(req);
      if (!(await assertDeviceAllowed(res, user.id, deviceIdFromReq(req)))) return;
      // Per-account bucket: rotating source addresses must not allow
      // brute-forcing one account's current password.
      if (!checkAuthRateLimit(`changepw:${user.id}`)) {
        res.status(429).json({ error: "Too many requests. Try again shortly." });
        return;
      }
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
      res.status(400).json({ error: "Request failed. Please try again." });
    }
  });

  app.post("/api/auth/delete-account", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!(await assertDeviceAllowed(res, user.id, deviceIdFromReq(req)))) return;
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
      res
        .status(400)
        .json({ error: safeAuthErrorMessage(e, "Request failed. Please try again.") });
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
      if (!(await assertDeviceAllowed(res, user.id, deviceIdFromReq(req)))) return;
      if ((user as any).emailVerified) {
        res.json({ success: true, alreadyVerified: true });
        return;
      }
      // Per-account bucket alongside the per-IP one above: an authenticated
      // caller rotating egress addresses must not spam token issuance.
      if (!checkAuthRateLimit(`resend:${user.id}`)) {
        res.status(429).json({ error: "Too many requests. Try again shortly." });
        return;
      }
      const email = (user as any).email ?? "";
      const token = randomUUID();
      const expiresAt = Date.now() + PASSWORD_RESET_TTL_MS;
      await db.createEmailVerificationToken(user.id, hashToken(token), expiresAt);
      if (email) {
        const base = webBaseUrl();
        const link = base
          ? `${base}/verify-email?token=${encodeURIComponent(token)}`
          : "";
        await sendEmail({
          to: email,
          subject: "Verify your Product Stock Finder email",
          text:
            `Confirm your email address.\n\n` +
            (link
              ? `Verify here (expires in 1 hour): ${link}\n\n`
              : `Use this verification token in the app (expires in 1 hour): ${token}\n\n`) +
            `If you did not request this, you can ignore this email.`,
          html:
            `<p>Confirm your email address.</p>` +
            (link
              ? `<p><a href="${link}">Verify your email</a> (expires in 1 hour).</p>`
              : `<p>Use this verification token in the app (expires in 1 hour): <code>${token}</code></p>`) +
            `<p>If you did not request this, you can ignore this email.</p>`,
        });
      }
      res.json({ success: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Invalid session") || msg.includes("User not found")) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      console.error("[Auth] resend-verification failed", e);
      res.status(400).json({ error: "Request failed. Please try again." });
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
      const row = await db.consumeEmailVerificationToken(tokenHash);
      if (!row) {
        res.status(400).json({ error: "Invalid or expired token" });
        return;
      }
      await db.setUserEmailVerified(row.userId);
      res.json({ success: true });
    } catch (e: unknown) {
      console.error("[Auth] verify failed", e);
      res
        .status(400)
        .json({ error: safeAuthErrorMessage(e, "Verification failed") });
    }
  });
}
