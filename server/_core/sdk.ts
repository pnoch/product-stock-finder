import {
  COOKIE_NAME,
  SESSION_MS,
} from "../../shared/const.js";
import { ForbiddenError } from "../../shared/_core/errors.js";
import bcrypt from "bcryptjs";
import { parse as parseCookieHeader } from "cookie";
import { randomUUID } from "crypto";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import type { RegisterRequest, LoginRequest, AuthResponse } from "./types/authTypes";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
  deviceId?: string | null;
  /**
   * The account's `credentialsChangedAt` value at mint time. A token is
   * rejected once the stored value advances past this, which invalidates every
   * session issued before a password change — including device ids that were
   * never registered and therefore cannot be enumerated for revocation.
   */
  credentialsChangedAt?: number;
};

const SALT_ROUNDS = 10;

class SDKServer {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) return new Map<string, string>();
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  /**
   * Creates an account without signing the caller in. Returning a session here
   * would make register a trivial account-existence oracle (a fresh email gets
   * a session, an existing one does not), so both outcomes are identical
   * `{ created }` results and the caller must sign in afterwards.
   */
  async registerAccount(
    req: RegisterRequest,
  ): Promise<{ created: boolean; email: string }> {
    const normalizedEmail = req.email.trim().toLowerCase();
    const existing = await db.getUserByEmail(normalizedEmail);
    // Hash even when the email exists so the two paths do not differ by timing.
    const passwordHash = await bcrypt.hash(req.password, SALT_ROUNDS);
    if (existing) return { created: false, email: normalizedEmail };

    const openId = `email_${Date.now()}_${randomUUID()}`;
    // Single transaction: a crash between the insert and the hash update would
    // otherwise leave an account that can never log in and cannot re-register.
    await db.createUserWithPassword(
      {
        openId,
        email: normalizedEmail,
        name: req.name || normalizedEmail.split("@")[0],
        loginMethod: "email",
        lastSignedIn: new Date(),
      } as any,
      passwordHash,
    );

    return { created: true, email: normalizedEmail };
  }

  async login(req: LoginRequest): Promise<AuthResponse> {
    const normalizedEmail = req.email.trim().toLowerCase();
    const user = await db.getUserByEmail(normalizedEmail);
    if (!user || !user.passwordHash) {
      // Hash anyway: returning immediately made an unknown email measurably
      // faster than a wrong password, a second account-existence oracle.
      await bcrypt.compare(req.password, dummyPasswordHash());
      throw ForbiddenError("Invalid email or password");
    }

    const valid = await bcrypt.compare(req.password, user.passwordHash);
    if (!valid) {
      throw ForbiddenError("Invalid email or password");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: new Date(),
    });

    const sessionToken = await this.createSessionToken(user.openId, {
      name: user.name || normalizedEmail,
      expiresInMs: SESSION_MS,
      deviceId: req.deviceId,
      credentialsChangedAt: Number(
        (user as { credentialsChangedAt?: number }).credentialsChangedAt ?? 0,
      ),
    });

    return {
      user: { id: user.id, email: user.email!, name: user.name, openId: user.openId },
      sessionToken,
    };
  }

  async createSessionToken(
    openId: string,
    options: {
      expiresInMs?: number;
      name?: string;
      deviceId?: string;
      credentialsChangedAt?: number;
    } = {},
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
        deviceId: options.deviceId ?? null,
        credentialsChangedAt: options.credentialsChangedAt ?? 0,
      },
      options,
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {},
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? SESSION_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
      cca: payload.credentialsChangedAt ?? 0,
      ...(payload.deviceId ? { deviceId: payload.deviceId } : {}),
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(cookieValue: string | undefined | null): Promise<{
    openId: string;
    appId: string;
    name: string;
    deviceId: string | null;
    credentialsChangedAt: number;
  } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      // `name` is display-only and may legitimately be empty (e.g. an OAuth
      // account with no profile name). Requiring it here would mint tokens the
      // server then rejects, locking the user out permanently.
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name: typeof name === "string" ? name : "",
        deviceId:
          typeof payload.deviceId === "string" ? payload.deviceId : null,
        // Tokens minted before the claim existed carry no cca: treat them as
        // epoch 0 so they are invalidated once an account changes credentials.
        credentialsChangedAt:
          typeof payload.cca === "number" && Number.isFinite(payload.cca)
            ? payload.cca
            : 0,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  private lastSignInWrite = new Map<string, number>();

  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token: string | undefined;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }

    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = token || cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const sessionUserId = session.openId;
    let user = await db.getUserByOpenId(sessionUserId);

    if (!user) {
      throw ForbiddenError("User not found");
    }

    // Credential-change epoch: a token minted before the account's last
    // password change is invalid even though its signature and expiry are
    // still valid. This is the only check that reaches sessions whose device
    // id was never registered (they cannot be enumerated for revocation).
    const userEpoch = Number(
      (user as { credentialsChangedAt?: number }).credentialsChangedAt ?? 0,
    );
    if (session.credentialsChangedAt < userEpoch) {
      throw ForbiddenError("Session expired");
    }

    const lastSignIn = user.lastSignedIn instanceof Date ? user.lastSignedIn : new Date(user.lastSignedIn ?? 0);
    const hoursSinceLastSignIn = (Date.now() - lastSignIn.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastSignIn >= 24) {
      const lastWrite = this.lastSignInWrite.get(user.openId) ?? 0;
      if (Date.now() - lastWrite > 60_000) {
        this.lastSignInWrite.set(user.openId, Date.now());
        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });
        if (this.lastSignInWrite.size > 1000) {
          const oldest = [...this.lastSignInWrite.entries()].sort((a, b) => a[1] - b[1])[0]?.[0];
          if (oldest) this.lastSignInWrite.delete(oldest);
        }
      }
    }

    return {
      ...user,
      sessionDeviceId: session.deviceId ?? null,
    };
  }
}

export type AuthenticatedUser = User & {
  sessionDeviceId?: string | null;
};

// Lazily built once so the dummy comparison costs the same as a real one.
let cachedDummyHash: string | null = null;
function dummyPasswordHash(): string {
  if (!cachedDummyHash) {
    cachedDummyHash = bcrypt.hashSync("not-a-real-password", 10);
  }
  return cachedDummyHash;
}

export const sdk = new SDKServer();
