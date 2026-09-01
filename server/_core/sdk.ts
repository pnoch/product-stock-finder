import {
  COOKIE_NAME,
  ONE_YEAR_MS,
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

  async register(req: RegisterRequest): Promise<AuthResponse> {
    const normalizedEmail = req.email.trim().toLowerCase();
    const existing = await db.getUserByEmail(normalizedEmail);
    if (existing) {
      throw ForbiddenError("Email already registered");
    }

    const passwordHash = await bcrypt.hash(req.password, SALT_ROUNDS);
    const openId = `email_${Date.now()}_${randomUUID()}`;

    await db.upsertUser({
      openId,
      email: normalizedEmail,
      name: req.name || normalizedEmail.split("@")[0],
      loginMethod: "email",
      lastSignedIn: new Date(),
    });

    await db.updateUserPasswordHash(openId, passwordHash);

    const user = await db.getUserByOpenId(openId);
    if (!user) throw ForbiddenError("Registration failed");

    const sessionToken = await this.createSessionToken(openId, {
      name: user.name || normalizedEmail,
      expiresInMs: ONE_YEAR_MS,
    });

    return {
      user: { id: user.id, email: normalizedEmail, name: user.name, openId },
      sessionToken,
    };
  }

  async login(req: LoginRequest): Promise<AuthResponse> {
    const normalizedEmail = req.email.trim().toLowerCase();
    const user = await db.getUserByEmail(normalizedEmail);
    if (!user || !user.passwordHash) {
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
      expiresInMs: ONE_YEAR_MS,
    });

    return {
      user: { id: user.id, email: user.email!, name: user.name, openId: user.openId },
      sessionToken,
    };
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string; deviceId?: string } = {},
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
        deviceId: options.deviceId ?? null,
      },
      options,
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {},
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
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

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
        deviceId:
          typeof payload.deviceId === "string" ? payload.deviceId : null,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

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

    const lastSignIn = user.lastSignedIn instanceof Date ? user.lastSignedIn : new Date(user.lastSignedIn ?? 0);
    const hoursSinceLastSignIn = (Date.now() - lastSignIn.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastSignIn >= 24) {
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });
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

export const sdk = new SDKServer();
