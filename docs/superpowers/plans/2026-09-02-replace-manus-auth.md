# Replace Manus OAuth with Email/Password Auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Manus platform dependency and replace with self-contained email/password authentication (ZeroTier-style — simple, no third-party auth provider).

**Architecture:** Add `passwordHash` column to `users` table. Replace Manus OAuth SDK (`exchangeCodeForToken`, `getUserInfo`, `getUserInfoWithJwt`) with bcrypt-based registration + login. Keep existing JWT session infrastructure (`createSessionToken`, `verifySession`, `authenticateRequest`). Remove Manus-specific env vars and types.

**Tech Stack:** bcryptjs (password hashing), existing jose JWT (session tokens), Drizzle ORM (schema migration), existing SecureStore/localStorage (client token persistence).

---

### Task 1: Schema — add passwordHash to users

**Files:**
- Modify: `drizzle/schema.ts:22-37`

- [ ] **Step 1: Add passwordHash column to users table**

```typescript
// drizzle/schema.ts — add after line 32 (loginMethod)
passwordHash: varchar("passwordHash", { length: 256 }),
```

- [ ] **Step 2: Generate migration**

Run: `pnpm exec drizzle-kit generate`
Expected: Creates `drizzle/0018_*.sql` with `ALTER TABLE users ADD COLUMN passwordHash varchar(256)`

- [ ] **Step 3: Apply migration**

Run: `pnpm db:push`
Expected: `migrations applied successfully!`

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema.ts drizzle/0018_*
git commit -m "feat: add passwordHash column to users table"
```

---

### Task 2: Server — install bcryptjs, add types

**Files:**
- Create: `server/_core/types/authTypes.ts`
- Modify: `package.json` (add bcryptjs + @types/bcryptjs)

- [ ] **Step 1: Install bcryptjs**

Run: `pnpm add bcryptjs && pnpm add -D @types/bcryptjs`
Expected: installed successfully

- [ ] **Step 2: Create auth types**

```typescript
// server/_core/types/authTypes.ts
export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: number;
    email: string;
    name: string | null;
    openId: string;
  };
  sessionToken: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add server/_core/types/authTypes.ts package.json pnpm-lock.yaml
git commit -m "feat: add bcryptjs and auth types for email/password auth"
```

---

### Task 3: Server — replace Manus SDK with email/password SDK

**Files:**
- Rewrite: `server/_core/sdk.ts`

- [ ] **Step 1: Rewrite sdk.ts — remove Manus OAuth, add email/password**

Replace the entire file with:

```typescript
// server/_core/sdk.ts
import {
  COOKIE_NAME,
  ONE_YEAR_MS,
  AXIOS_TIMEOUT_MS,
} from "../../shared/const.js";
import { ForbiddenError } from "../../shared/_core/errors.js";
import bcrypt from "bcryptjs";
import { parse as parseCookieHeader } from "cookie";
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
    const existing = await db.getUserByEmail(req.email);
    if (existing) {
      throw ForbiddenError("Email already registered");
    }

    const passwordHash = await bcrypt.hash(req.password, SALT_ROUNDS);
    const openId = `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await db.upsertUser({
      openId,
      email: req.email,
      name: req.name || req.email.split("@")[0],
      loginMethod: "email",
      lastSignedIn: new Date(),
    });

    // Store password hash — upsertUser doesn't handle passwordHash,
    // so we update it directly
    await db.updateUserPasswordHash(openId, passwordHash);

    const user = await db.getUserByOpenId(openId);
    if (!user) throw ForbiddenError("Registration failed");

    const sessionToken = await this.createSessionToken(openId, {
      name: user.name || req.email,
      expiresInMs: ONE_YEAR_MS,
    });

    return {
      user: { id: user.id, email: req.email, name: user.name, openId },
      sessionToken,
    };
  }

  async login(req: LoginRequest): Promise<AuthResponse> {
    const user = await db.getUserByEmail(req.email);
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
      name: user.name || req.email,
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
    const signedInAt = new Date();
    let user = await db.getUserByOpenId(sessionUserId);

    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

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
```

- [ ] **Step 2: Commit**

```bash
git add server/_core/sdk.ts
git commit -m "feat: replace Manus OAuth SDK with email/password auth"
```

---

### Task 4: Server — add getUserByEmail and updateUserPasswordHash to db.ts

**Files:**
- Modify: `server/db.ts`

- [ ] **Step 1: Add getUserByEmail function**

```typescript
// server/db.ts — add after getUserByOpenId function
export async function getUserByEmail(email: string) {
  const db = getDb();
  if (!db) return null;
  const rows = await db.select().from(schema.users).where(
    eq(schema.users.email, email)
  ).limit(1);
  return rows[0] ?? null;
}
```

- [ ] **Step 2: Add updateUserPasswordHash function**

```typescript
// server/db.ts — add after getUserByEmail
export async function updateUserPasswordHash(openId: string, passwordHash: string) {
  const db = getDb();
  if (!db) return;
  await db.update(schema.users)
    .set({ passwordHash } as any)
    .where(eq(schema.users.openId, openId));
}
```

Note: Using `as any` because Drizzle doesn't know about the new column yet in TypeScript until after codegen. Will be fixed on next `db:push`.

- [ ] **Step 3: Commit**

```bash
git add server/db.ts
git commit -m "feat: add getUserByEmail and updateUserPasswordHash to db"
```

---

### Task 5: Server — replace OAuth routes with email/password routes

**Files:**
- Rewrite: `server/_core/oauth.ts`

- [ ] **Step 1: Rewrite oauth.ts — email/password register + login**

Replace the entire file with:

```typescript
// server/_core/oauth.ts
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
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
  // Email/password registration
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
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

  // Email/password login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
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

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // Get current authenticated user
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/me failed:", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  // Legacy OAuth callback — no longer used, redirect to app
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect(302, "/");
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add server/_core/oauth.ts
git commit -m "feat: replace OAuth routes with email/password register + login"
```

---

### Task 6: Server — clean up env.ts and remove Manus types

**Files:**
- Modify: `server/_core/env.ts`
- Delete: `server/_core/types/manusTypes.ts`

- [ ] **Step 1: Simplify env.ts — remove Manus vars**

```typescript
// server/_core/env.ts
export const ENV = {
  appId: process.env.VITE_APP_ID ?? "stock-finder",
  cookieSecret: process.env.JWT_SECRET ?? "dev-secret-change-in-production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
```

- [ ] **Step 2: Delete Manus types**

Run: `rm server/_core/types/manusTypes.ts`

- [ ] **Step 3: Commit**

```bash
git add server/_core/env.ts
git rm server/_core/types/manusTypes.ts
git commit -m "feat: remove Manus env vars and types, simplify to email/password"
```

---

### Task 7: Client — simplify constants/oauth.ts

**Files:**
- Rewrite: `constants/oauth.ts`

- [ ] **Step 1: Simplify constants/oauth.ts**

Replace the entire file with:

```typescript
// constants/oauth.ts
import { getDeviceId } from "@/lib/device-id";
import * as Linking from "expo-linking";
import * as ReactNative from "react-native";

const bundleId = "com.app.stock_tracker_pro";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: schemeFromBundleId,
};

export const API_BASE_URL = env.apiBaseUrl;

export function getApiBaseUrl(): string {
  if (API_BASE_URL) return API_BASE_URL.replace(/\/$/, "");

  if (
    ReactNative.Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location
  ) {
    const { protocol, hostname } = window.location;
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) return `${protocol}//${apiHostname}`;
  }

  return "";
}

export function isServerConfigured(): boolean {
  return getApiBaseUrl() !== "";
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "manus-runtime-user-info";

export const getRedirectUri = () => {
  if (ReactNative.Platform.OS === "web") return `${getApiBaseUrl()}/api/auth/callback`;
  return Linking.createURL("/oauth/callback", { scheme: env.deepLinkScheme });
};

// Legacy — no longer needed, kept for backwards compat
export async function getLoginUrl(): Promise<string> {
  return `${getApiBaseUrl()}/api/auth/login`;
}

export async function startOAuthLogin(): Promise<string | null> {
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add constants/oauth.ts
git commit -m "feat: simplify constants/oauth.ts — remove Manus portal/server vars"
```

---

### Task 8: Client — add login/register to useAuth hook

**Files:**
- Modify: `hooks/use-auth.ts`

- [ ] **Step 1: Add login and register functions to useAuth**

Add these callbacks inside the `useAuth` function, after the existing `logout` callback:

```typescript
// hooks/use-auth.ts — add after logout callback (line ~100)
const login = useCallback(async (email: string, password: string) => {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Login failed");
    }
    const data = await res.json();
    if (data.sessionToken && Platform.OS !== "web") {
      await Auth.setSessionToken(data.sessionToken);
    }
    if (data.user) {
      const userInfo: Auth.User = {
        id: data.user.id,
        openId: data.user.openId,
        name: data.user.name,
        email: data.user.email,
        loginMethod: "email",
        lastSignedIn: new Date(),
      };
      await Auth.setUserInfo(userInfo);
      setUser(userInfo);
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error("Login failed");
  }
}, []);

const register = useCallback(async (email: string, password: string, name?: string) => {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Registration failed");
    }
    const data = await res.json();
    if (data.sessionToken && Platform.OS !== "web") {
      await Auth.setSessionToken(data.sessionToken);
    }
    if (data.user) {
      const userInfo: Auth.User = {
        id: data.user.id,
        openId: data.user.openId,
        name: data.user.name,
        email: data.user.email,
        loginMethod: "email",
        lastSignedIn: new Date(),
      };
      await Auth.setUserInfo(userInfo);
      setUser(userInfo);
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error("Registration failed");
  }
}, []);
```

Update the return statement to include `login` and `register`:

```typescript
return {
  user,
  loading,
  error,
  isAuthenticated,
  refresh: fetchUser,
  logout,
  login,
  register,
};
```

- [ ] **Step 2: Add import for getApiBaseUrl**

```typescript
// hooks/use-auth.ts — add to imports at top
import { getApiBaseUrl } from "@/constants/oauth";
```

- [ ] **Step 3: Commit**

```bash
git add hooks/use-auth.ts
git commit -m "feat: add login and register functions to useAuth hook"
```

---

### Task 9: Client — remove OAuth callback screen

**Files:**
- Simplify: `app/oauth/callback.tsx`

- [ ] **Step 1: Simplify callback.tsx — just redirect to home**

Replace the entire file with:

```typescript
// app/oauth/callback.tsx
import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function OAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/oauth/callback.tsx
git commit -m "feat: simplify OAuth callback to just redirect home"
```

---

### Task 10: Update .env — remove Manus vars, add JWT_SECRET

**Files:**
- Modify: `.env`

- [ ] **Step 1: Update .env**

```bash
# Remove these lines:
EXPO_PUBLIC_OAUTH_PORTAL_URL=
EXPO_PUBLIC_OAUTH_SERVER_URL=
EXPO_PUBLIC_APP_ID=
EXPO_PUBLIC_OWNER_OPEN_ID=
EXPO_PUBLIC_OWNER_NAME=

# Add this:
JWT_SECRET=dev-secret-change-in-production
```

- [ ] **Step 2: Commit**

```bash
git add .env
git commit -m "feat: update .env — remove Manus vars, add JWT_SECRET"
```

---

### Task 11: Clean up — remove Manus LLM endpoints and storage proxy

**Files:**
- Modify: `server/_core/llm.ts` (replace forge.manus.im URLs with configurable)
- Modify: `server/_core/heartbeat.ts` (remove x-manus-user-session header)
- Modify: `server/_core/storageProxy.ts` (remove manus-storage route)

- [ ] **Step 1: Replace Manus LLM URLs in llm.ts**

Search for `forge.manus.im` and replace with a configurable env var:

```typescript
// server/_core/llm.ts — replace hardcoded URLs
const LLM_BASE_URL = process.env.LLM_API_URL ?? "";
```

- [ ] **Step 2: Remove Manus-specific headers in heartbeat.ts**

Remove `x-manus-user-session` header reference.

- [ ] **Step 3: Commit**

```bash
git add server/_core/llm.ts server/_core/heartbeat.ts
git commit -m "feat: remove Manus-specific LLM URLs and headers"
```

---

### Task 12: Run full verification

**Files:** None (verification only)

- [ ] **Step 1: Type check**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 3: Tests**

Run: `pnpm test`
Expected: All passing

- [ ] **Step 4: Verify server starts**

Run: `pnpm dev:server`
Expected: Server starts without "OAUTH_SERVER_URL is not configured" error

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Manus OAuth removal — email/password auth system"
```
