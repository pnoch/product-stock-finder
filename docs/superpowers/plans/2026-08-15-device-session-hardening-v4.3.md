# Device Session Hardening & Un-Revoke v4.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the three v4.3 known limitations: un-revoke a device via re-login, bind sessions to the device via a JWT `deviceId` claim (tamper-proof revocation), and stop cleanup from unbinding the active device.

**Architecture:** Embed `deviceId` into the issued session JWT (stateless, no registry). Login flows (web cookie + native token) carry `deviceId` through the OAuth `state` param; `createContext` checks revocation against the token claim first, header as fallback. A successful OAuth login calls a new `unrevokeDevice()` helper. `cleanupStaleDevices` gains an `excludeDeviceId` param.

**Tech Stack:** Express + tRPC v11, Drizzle (MySQL), jose (JWT HS256), Expo Router, vitest, pnpm.

---

### Task 1: Shared OAuth state encode/decode helpers

**Files:**
- Create: `shared/oauth-state.ts`
- Test: `tests/oauth-state.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/oauth-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { encodeOAuthState, decodeOAuthState } from "../shared/oauth-state";

describe("oauth-state", () => {
  it("round-trips redirectUri and deviceId", () => {
    const state = encodeOAuthState("http://localhost:8081/oauth/callback", "dev-1");
    expect(decodeOAuthState(state)).toEqual({
      redirectUri: "http://localhost:8081/oauth/callback",
      deviceId: "dev-1",
    });
  });

  it("round-trips without a deviceId", () => {
    const state = encodeOAuthState("http://localhost:8081/oauth/callback");
    expect(decodeOAuthState(state)).toEqual({
      redirectUri: "http://localhost:8081/oauth/callback",
      deviceId: undefined,
    });
  });

  it("decodes a legacy plain-base64 state", () => {
    const legacy = btoa("http://localhost:8081/oauth/callback");
    expect(decodeOAuthState(legacy)).toEqual({
      redirectUri: "http://localhost:8081/oauth/callback",
      deviceId: undefined,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/oauth-state.test.ts`
Expected: FAIL — `Cannot find module '../shared/oauth-state'`.

- [ ] **Step 3: Write minimal implementation**

Create `shared/oauth-state.ts`:

```ts
function btoaSafe(value: string): string {
  if (typeof globalThis.btoa === "function") return globalThis.btoa(value);
  const BufferImpl = (globalThis as Record<string, unknown>).Buffer as
    | typeof Buffer
    | undefined;
  if (BufferImpl) return BufferImpl.from(value, "utf-8").toString("base64");
  return value;
}

function atobSafe(value: string): string {
  if (typeof globalThis.atob === "function") return globalThis.atob(value);
  const BufferImpl = (globalThis as Record<string, unknown>).Buffer as
    | typeof Buffer
    | undefined;
  if (BufferImpl) return BufferImpl.from(value, "base64").toString("utf-8");
  return value;
}

export function encodeOAuthState(
  redirectUri: string,
  deviceId?: string,
): string {
  return btoaSafe(JSON.stringify({ redirectUri, deviceId }));
}

export function decodeOAuthState(
  state: string,
): { redirectUri: string; deviceId: string | undefined } {
  const decoded = atobSafe(state);
  try {
    const parsed = JSON.parse(decoded) as {
      redirectUri?: string;
      deviceId?: string;
    };
    if (typeof parsed.redirectUri === "string") {
      return { redirectUri: parsed.redirectUri, deviceId: parsed.deviceId };
    }
  } catch {
    // fall through to the legacy plain-base64 form
  }
  return { redirectUri: decoded, deviceId: undefined };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/oauth-state.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/oauth-state.ts tests/oauth-state.test.ts
git commit -m "feat(auth): add shared OAuth state encode/decode helpers with deviceId"
```

---

### Task 2: Session token deviceId claim

**Files:**
- Modify: `server/_core/sdk.ts`
- Test: `tests/session-binding.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/session-binding.test.ts`:

```ts
vi.hoisted(() => {
  process.env.JWT_SECRET = "test-secret";
});

import { describe, expect, it } from "vitest";
import { sdk } from "../server/_core/sdk";

describe("session device binding", () => {
  it("round-trips a deviceId through createSessionToken and verifySession", async () => {
    const token = await sdk.createSessionToken("open-1", {
      name: "U",
      deviceId: "dev-1",
    });
    const session = await sdk.verifySession(token);
    expect(session).toMatchObject({ openId: "open-1", deviceId: "dev-1" });
  });

  it("returns deviceId null for a token without a claim", async () => {
    const token = await sdk.createSessionToken("open-1", { name: "U" });
    const session = await sdk.verifySession(token);
    expect(session?.deviceId).toBeNull();
  });

  it("signs and verifies a legacy payload without deviceId", async () => {
    const token = await sdk.signSession({
      openId: "open-1",
      appId: "app",
      name: "U",
    });
    const session = await sdk.verifySession(token);
    expect(session?.deviceId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/session-binding.test.ts`
Expected: FAIL — `session?.deviceId` is undefined / `expect(undefined).toBe("dev-1")`.

- [ ] **Step 3: Implement the deviceId claim in sdk.ts**

In `server/_core/sdk.ts`, make these edits:

3a. Add the shared helper import (top of file, next to the existing `const.js` import):

```ts
import { decodeOAuthState } from "../../shared/oauth-state.js";
```

3b. Extend `SessionPayload` (currently `{ openId: string; appId: string; name: string; }`):

```ts
export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
  deviceId?: string | null;
};
```

3c. Replace the private `decodeState` method (lines ~45-48) with nothing and update `getTokenByCode` (lines ~50-61). The method is deleted; `getTokenByCode` now derives the redirectUri from the shared decode:

```ts
  async getTokenByCode(
    code: string,
    state: string,
  ): Promise<ExchangeTokenResponse> {
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: decodeOAuthState(state).redirectUri,
    };

    const { data } = await this.client.post<ExchangeTokenResponse>(
      EXCHANGE_TOKEN_PATH,
      payload,
    );

    return data;
  }
```

3d. Update `createSessionToken` (lines ~171-183) to accept and pass `deviceId`:

```ts
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
```

3e. Update `signSession` (lines ~185-202) to embed the claim only when present:

```ts
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
```

3f. Update `verifySession` (lines ~204-237) return type + parse. The signature currently is:

```ts
  async verifySession(
    cookieValue: string | undefined | null,
  ): Promise<{ openId: string; appId: string; name: string } | null> {
```

Change it to:

```ts
  async verifySession(
    cookieValue: string | undefined | null,
  ): Promise<{ openId: string; appId: string; name: string; deviceId: string | null } | null> {
```

And the return statement currently is:

```ts
      return {
        openId,
        appId,
        name,
      };
```

Change it to:

```ts
      return {
        openId,
        appId,
        name,
        deviceId:
          typeof payload.deviceId === "string" ? payload.deviceId : null,
      };
```

3g. Extend `AuthenticatedUser` type (lines ~326-329):

```ts
export type AuthenticatedUser = User & {
  taskUid?: string;
  isCron?: boolean;
  sessionDeviceId?: string | null;
};
```

3h. Attach the claim in `authenticateRequest` (lines ~263-320). The normal path currently ends with `return user;`. Change it to:

```ts
    return {
      ...user,
      sessionDeviceId: session.deviceId ?? null,
    };
```

3i. Add `sessionDeviceId: null` to `buildCronUser` (lines ~331-348), so the returned object includes it:

```ts
function buildCronUser(
  userInfo: GetUserInfoWithJwtResponse,
): AuthenticatedUser {
  const now = new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? undefined,
    isCron: true,
    sessionDeviceId: null,
  } as AuthenticatedUser;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/session-binding.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run typecheck + full devices tests to confirm no breakage**

Run: `pnpm check`
Expected: `tsc --noEmit` exits 0.

Run: `pnpm test tests/devices.test.ts tests/device-revoked.test.ts tests/auth.logout.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add server/_core/sdk.ts tests/session-binding.test.ts
git commit -m "feat(auth): bind deviceId into session JWTs and expose it to the context"
```

---

### Task 3: Claim-authoritative revocation check in createContext

**Files:**
- Modify: `server/_core/context.ts`
- Test: `tests/device-revoked.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append to `tests/device-revoked.test.ts` inside the `describe("createContext revocation check")` block (after the existing 4 tests, before the block closes):

```ts
  it("throws DEVICE_REVOKED based on the token claim even when the header is absent", async () => {
    mockedAuth.mockResolvedValue({ id: 7, sessionDeviceId: "dev-claim" } as any);
    mockedRevoked.mockResolvedValue(true);
    await expect(
      createContext({ req: makeReq(), res: makeRes() } as any),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: DEVICE_REVOKED_ERR_MSG,
    });
  });

  it("prefers the token claim over the header for ctx.deviceId", async () => {
    mockedAuth.mockResolvedValue({ id: 7, sessionDeviceId: "dev-claim" } as any);
    mockedRevoked.mockResolvedValue(false);
    const ctx = await createContext({
      req: makeReq({ "x-device-id": "dev-header" }),
      res: makeRes(),
    } as any);
    expect(ctx.deviceId).toBe("dev-claim");
  });

  it("falls back to the header when the token has no deviceId claim", async () => {
    mockedAuth.mockResolvedValue({ id: 7, sessionDeviceId: null } as any);
    mockedRevoked.mockResolvedValue(true);
    await expect(
      createContext({
        req: makeReq({ "x-device-id": "dev-header" }),
        res: makeRes(),
      } as any),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: DEVICE_REVOKED_ERR_MSG,
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/device-revoked.test.ts`
Expected: FAIL — new tests throw `ctx.deviceId` null / no FORBIDDEN (claim not read yet).

- [ ] **Step 3: Implement claim-authoritative check**

Rewrite `server/_core/context.ts` as follows (full file):

```ts
import { TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { DEVICE_REVOKED_ERR_MSG } from "../../shared/const.js";
import { isDeviceRevoked } from "../devices";
import { sdk, type AuthenticatedUser } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
  deviceId: string | null;
};

export async function createContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  let user: AuthenticatedUser | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const rawDeviceId = opts.req.headers["x-device-id"];
  const headerDeviceId =
    typeof rawDeviceId === "string" ? rawDeviceId : null;
  const claimDeviceId = user?.sessionDeviceId ?? null;
  const effectiveDeviceId = claimDeviceId ?? headerDeviceId;

  if (effectiveDeviceId && user) {
    const revoked = await isDeviceRevoked(effectiveDeviceId);
    if (revoked) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: DEVICE_REVOKED_ERR_MSG,
      });
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    deviceId: effectiveDeviceId,
  };
}
```

Note: the old `import type { User } from "../../drizzle/schema"` is removed; the `AuthenticatedUser` type is imported from `./sdk`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/device-revoked.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Run typecheck + router tests**

Run: `pnpm check`
Expected: `tsc --noEmit` exits 0.

Run: `pnpm test tests/devices-router.test.ts tests/auth.logout.test.ts tests/notifications-router.test.ts`
Expected: all PASS (the context user type widened to `AuthenticatedUser` is a superset of the old `User`, so test contexts still typecheck).

- [ ] **Step 6: Commit**

```bash
git add server/_core/context.ts tests/device-revoked.test.ts
git commit -m "feat(auth): enforce device revocation from the session token claim"
```

---

### Task 4: unrevokeDevice + cleanup exclusion

**Files:**
- Modify: `server/devices.ts`
- Modify: `server/routers.ts`
- Test: `tests/devices.test.ts` (extend)
- Test: `tests/devices-router.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

1a. In `tests/devices.test.ts`, add `unrevokeDevice` to the import from `"../server/devices"` (alphabetical, after `renameDevice`):

```ts
  unbindDevice,
  renameDevice,
  unrevokeDevice,
  signOutDevice,
```

1b. Add these tests to the `describe("devices (memory backend)")` block:

```ts
  it("un-revokes a device so it can authenticate again", async () => {
    await upsertDeviceConfig("dev-1", baseConfig, 7);
    await signOutDevice(7, "dev-1");
    expect(await isDeviceRevoked("dev-1")).toBe(true);
    await unrevokeDevice("dev-1");
    expect(await isDeviceRevoked("dev-1")).toBe(false);
  });

  it("un-revoking a clean device is a no-op", async () => {
    await unrevokeDevice("dev-1");
    expect(await isDeviceRevoked("dev-1")).toBe(false);
  });
```

1c. Add these tests to the `describe("devices (database backend)")` block:

```ts
  it("un-revokes by deleting the revoked_devices row", async () => {
    const deleted: unknown[] = [];
    const dbStub = {
      delete: vi.fn((table: unknown) => {
        deleted.push(table);
        return { where: vi.fn(async () => undefined) };
      }),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    await unrevokeDevice("dev-1");
    expect(deleted).toEqual([revokedDevices]);
    mockedGetDb.mockResolvedValue(null);
  });

  it("excludes the caller's deviceId during cleanup", async () => {
    const deleted: unknown[] = [];
    const dbStub = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === deviceNotificationConfigs) {
            return {
              where: vi.fn(async () => [
                { deviceId: "stale", userId: 7, updatedAt: 1000 },
                { deviceId: "fresh", userId: 7, updatedAt: Date.now() },
              ]),
            };
          }
          if (table === deviceLabels) return Promise.resolve([]);
          return { where: vi.fn(async () => []) };
        }),
      })),
      delete: vi.fn((table: unknown) => {
        deleted.push(table);
        return { where: vi.fn(async () => undefined) };
      }),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);
    const removed = await cleanupStaleDevices(7, Date.now() - 5000, "stale");
    expect(removed).toBe(0);
    expect(deleted).toEqual([]);
    mockedGetDb.mockResolvedValue(null);
  });
```

1d. In `tests/devices-router.test.ts`, update the existing `cleanupStale` assertion (currently `toHaveBeenCalledWith(7, expect.any(Number))`) to include the null deviceId:

```ts
  it("cleans up stale devices for the signed-in user", async () => {
    mockedCleanup.mockResolvedValue(2);
    const caller = appRouter.createCaller(createAuthedContext(7));
    const result = await caller.devices.cleanupStale();
    expect(result).toEqual({ removed: 2 });
    expect(mockedCleanup).toHaveBeenCalledWith(7, expect.any(Number), null);
  });
```

1e. Add this test to `tests/devices-router.test.ts`:

```ts
  it("excludes the caller's deviceId when cleaning up stale devices", async () => {
    mockedCleanup.mockResolvedValue(1);
    const ctx = createAuthedContext(7);
    ctx.deviceId = "dev-current";
    const caller = appRouter.createCaller(ctx);
    const result = await caller.devices.cleanupStale();
    expect(result).toEqual({ removed: 1 });
    expect(mockedCleanup).toHaveBeenCalledWith(7, expect.any(Number), "dev-current");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/devices.test.ts tests/devices-router.test.ts`
Expected: FAIL — `unrevokeDevice` is not exported; cleanup assertion mismatch (`(7, number)` vs `(7, number, null)`); cleanup exclusion returns 1 instead of 0.

- [ ] **Step 3: Implement in server/devices.ts**

3a. Add `unrevokeDevice` after `signOutDevice` (after line ~207):

```ts
export async function unrevokeDevice(deviceId: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryRevokedDevices.delete(deviceId);
    return;
  }
  await db.delete(revokedDevices).where(eq(revokedDevices.deviceId, deviceId));
}
```

3b. Update `cleanupStaleDevices` signature and add the exclusion (currently lines ~209-222):

```ts
export async function cleanupStaleDevices(
  userId: number,
  cutoffMs: number,
  excludeDeviceId?: string | null,
): Promise<number> {
  const devices = await listDevicesForUser(userId);
  let removed = 0;
  for (const device of devices) {
    if (device.deviceId === excludeDeviceId) continue;
    if (device.lastSeenAt > 0 && device.lastSeenAt < cutoffMs) {
      await unbindDevice(userId, device.deviceId);
      removed += 1;
    }
  }
  return removed;
}
```

- [ ] **Step 4: Implement in server/routers.ts**

Update the `devices.cleanupStale` procedure (lines ~250-256) to pass `ctx.deviceId`:

```ts
    cleanupStale: protectedProcedure.mutation(async ({ ctx }) => {
      const removed = await cleanupStaleDevices(
        ctx.user.id,
        Date.now() - STALE_DEVICE_MS,
        ctx.deviceId,
      );
      return { removed };
    }),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test tests/devices.test.ts tests/devices-router.test.ts`
Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run: `pnpm check`
Expected: `tsc --noEmit` exits 0.

- [ ] **Step 7: Commit**

```bash
git add server/devices.ts server/routers.ts tests/devices.test.ts tests/devices-router.test.ts
git commit -m "feat(devices): add unrevokeDevice and exclude the caller from stale cleanup"
```

---

### Task 5: Login un-revokes + deviceId flows into the token

**Files:**
- Modify: `server/_core/oauth.ts`
- Modify: `constants/oauth.ts`
- No new tests (server handlers tested via sdk/session-binding coverage; client `getLoginUrl` is UI-adjacent, repo convention: no client unit tests)

- [ ] **Step 1: Server — add imports to `server/_core/oauth.ts`**

At the top, add to the existing imports:

```ts
import { decodeOAuthState } from "../../shared/oauth-state.js";
import { unrevokeDevice } from "../devices";
```

- [ ] **Step 2: Server — web callback reads deviceId + un-revokes + binds token**

In `server/_core/oauth.ts`, in the `/api/oauth/callback` handler, after the `if (!code || !state)` guard, inside the `try` block, add the deviceId decode as the first line:

```ts
    try {
      const { deviceId } = decodeOAuthState(state);
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      await syncUser(userInfo);
      if (deviceId) {
        try {
          await unrevokeDevice(deviceId);
        } catch (error) {
          console.error("[OAuth] Failed to un-revoke device:", error);
        }
      }
      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
        deviceId,
      });
```

The rest of the handler (cookie set + redirect) is unchanged.

- [ ] **Step 3: Server — mobile exchange reads deviceId + un-revokes + binds token**

In the `/api/oauth/mobile` handler, inside its `try` block, add the decode first, the un-revoke after `syncUser`, and pass `deviceId` to `createSessionToken`:

```ts
    try {
      const { deviceId } = decodeOAuthState(state);
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);
      if (deviceId) {
        try {
          await unrevokeDevice(deviceId);
        } catch (error) {
          console.error("[OAuth] Failed to un-revoke device:", error);
        }
      }
      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
        deviceId,
      });
```

- [ ] **Step 4: Client — `constants/oauth.ts` async getLoginUrl with deviceId**

Replace the `encodeState` helper (lines ~59-68) and `getLoginUrl` (lines ~85-96) with:

```ts
const encodeState = (value: string) => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  const BufferImpl = (globalThis as Record<string, any>).Buffer;
  if (BufferImpl) {
    return BufferImpl.from(value, "utf-8").toString("base64");
  }
  return value;
};
```

becomes (remove the helper entirely) and add imports at the top of the file:

```ts
import { getDeviceId } from "@/lib/device-id";
import { encodeOAuthState } from "@/shared/oauth-state";
```

Then `getLoginUrl`:

```ts
export async function getLoginUrl(): Promise<string> {
  const redirectUri = getRedirectUri();
  const deviceId = await getDeviceId();
  const state = encodeOAuthState(redirectUri, deviceId);

  const url = new URL(`${OAUTH_PORTAL_URL}/app-auth`);
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
}
```

- [ ] **Step 5: Client — `startOAuthLogin` awaits the async URL**

In `constants/oauth.ts`, `startOAuthLogin` currently does `const loginUrl = getLoginUrl();`. Change to:

```ts
export async function startOAuthLogin(): Promise<string | null> {
  const loginUrl = await getLoginUrl();
```

- [ ] **Step 6: Verify**

Run: `pnpm check`
Expected: `tsc --noEmit` exits 0.

Run: `pnpm lint`
Expected: only the pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning.

Run: `pnpm test`
Expected: full suite green (537 existing + new tests from Tasks 1-4).

- [ ] **Step 7: Commit**

```bash
git add server/_core/oauth.ts constants/oauth.ts
git commit -m "feat(auth): un-revoke devices on login and bind deviceId into issued tokens"
```

---

### Task 6: Checkpoint — format, gates, docs, push

**Files:**
- Modify: `todo.md` (Phase 43)
- Docs: `docs/superpowers/specs/2026-08-15-device-session-hardening-v4.3-design.md` (mark status if desired)

- [ ] **Step 1: Add Phase 43 to `todo.md`**

Append a new phase section at the end of `todo.md` (after Phase 42), matching the existing checkpoint style:

```markdown
## Phase 43: Device Session Hardening & Un-Revoke

- [x] Shared OAuth state helpers (shared/oauth-state.ts): encodeOAuthState/decodeOAuthState (deviceId in state, legacy base64 tolerated)
- [x] Device-bound sessions: deviceId claim in session JWTs (server/_core/sdk.ts); authenticateRequest exposes sessionDeviceId
- [x] createContext revocation check prefers the token claim over the x-device-id header
- [x] Login is the un-revoke: /api/oauth/callback + /api/oauth/mobile call unrevokeDevice(deviceId) and bind deviceId into the issued token
- [x] unrevokeDevice (server/devices.ts) clears the revoked_devices marker (memory/DB parallel)
- [x] cleanupStaleDevices excludes the caller's deviceId (router passes ctx.deviceId)
```

- [ ] **Step 2: Format touched files**

Run: `pnpm format` (prettier across the repo — only files changed by this phase will differ).
Or to be surgical:
```bash
pnpm exec prettier --write shared/oauth-state.ts tests/oauth-state.test.ts server/_core/sdk.ts tests/session-binding.test.ts server/_core/context.ts tests/device-revoked.test.ts server/devices.ts server/routers.ts tests/devices.test.ts tests/devices-router.test.ts server/_core/oauth.ts constants/oauth.ts
```

- [ ] **Step 3: Run all gates**

Run: `pnpm check`
Expected: `tsc --noEmit` exits 0.

Run: `pnpm lint`
Expected: only pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warning.

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 4: Review diff**

Run: `git status` and `git diff --stat`
Expected: the 11 files from this phase (5 modified server/client files, 2 new shared/test files, 5 modified test files) + `todo.md`.

- [ ] **Step 5: Commit checkpoint**

```bash
git add todo.md docs/superpowers/specs/2026-08-15-device-session-hardening-v4.3-design.md
git commit -m "Checkpoint: v4.3: device-bound sessions, login un-revoke, cleanup race fix. TypeScript: 0 errors."
```

- [ ] **Step 6: Push**

Run: `git push origin main`
Expected: pushes to `origin/main`.

---

## Implementation Order & Dependencies

1. **Task 1** — shared state helpers (no deps)
2. **Task 2** — sdk.ts session claim (depends on Task 1 for `decodeOAuthState`)
3. **Task 3** — context.ts (depends on Task 2's `sessionDeviceId`)
4. **Task 4** — devices unrevoke + cleanup exclusion (no deps on 1-3)
5. **Task 5** — oauth.ts + constants/oauth.ts (depends on Tasks 1, 2, 4)
6. **Task 6** — checkpoint
