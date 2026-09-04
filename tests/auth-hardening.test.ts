import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => {
  const store = new Map<string, { userId: number; token: string; expiresAt: number; usedAt: number | null }>();
  return {
    getUserByEmail: vi.fn(),
    getUserById: vi.fn(async () => ({ id: 42, passwordHash: "old-hash" })),
    createPasswordResetToken: vi.fn(),
    getPasswordResetToken: vi.fn(async (token: string) => store.get(token) ?? null),
    markPasswordResetTokenUsed: vi.fn(),
    consumePasswordResetToken: vi.fn(async () => null),
    consumeEmailVerificationToken: vi.fn(async () => null),
    updateUserPasswordHashById: vi.fn(),
    __consumeStore: store,
  };
});

vi.mock("../server/devices", () => ({
  isDeviceRevoked: vi.fn(async () => false),
  unrevokeDevice: vi.fn(async () => {}),
}));

vi.mock("../server/_core/sdk", () => ({
  sdk: {
    register: vi.fn(),
    login: vi.fn(async () => ({
      user: { id: 42, email: "a@b.com", name: "A" },
      sessionToken: "sess-1",
    })),
    authenticateRequest: vi.fn(async () => ({ id: 42, email: "a@b.com" })),
    createSessionToken: vi.fn(async () => "sess-1"),
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(async () => "hashed"), compare: vi.fn(async () => true) },
  hash: vi.fn(async () => "hashed"),
  compare: vi.fn(async () => true),
}));

import { registerOAuthRoutes } from "../server/_core/oauth";
import { getSessionCookieOptions } from "../server/_core/cookies";
import { consumePasswordResetToken } from "../server/db";
import * as devices from "../server/devices";

function makeApp() {
  const handlers: Record<string, Record<string, any>> = { POST: {}, GET: {} };
  const stub = {
    post: vi.fn((path: string, handler: any) => { handlers.POST[path] = handler; }),
    get: vi.fn((path: string, handler: any) => { handlers.GET[path] = handler; }),
  };
  registerOAuthRoutes(stub as any);
  return (method: "POST" | "GET", path: string) => handlers[method][path] as (req: any, res: any) => Promise<void>;
}

function makeReq(body: any = {}, extra: any = {}) {
  return { protocol: "http", hostname: "example.com", body, headers: {}, query: {}, ...extra } as any;
}
function makeRes() {
  const res: any = { status: vi.fn(), json: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn(), redirect: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe("auth hardening", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects password change from a revoked device", async () => {
    const handler = makeApp();
    vi.mocked(devices.isDeviceRevoked).mockResolvedValue(true);
    const res = makeRes();
    await handler("POST", "/api/auth/change-password")(
      makeReq(
        { currentPassword: "oldpass123", newPassword: "newpass123" },
        { headers: { "x-device-id": "revoked-dev" } },
      ),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("un-revokes the presenting device on successful login", async () => {
    const handler = makeApp();
    const res = makeRes();
    await handler("POST", "/api/auth/login")(
      makeReq(
        { email: "a@b.com", password: "oldpass123" },
        { headers: { "x-device-id": "dev-9" } },
      ),
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ sessionToken: "sess-1" }));
    expect(devices.unrevokeDevice).toHaveBeenCalledWith(42, "dev-9");
  });

  it("embeds the presenting deviceId in the session JWT at login", async () => {
    const handler = makeApp();
    const { sdk: mockedSdk } = await import("../server/_core/sdk");
    const res = makeRes();
    await handler("POST", "/api/auth/login")(
      makeReq(
        { email: "a@b.com", password: "oldpass123" },
        { headers: { "x-device-id": "dev-9" } },
      ),
      res,
    );
    expect(vi.mocked(mockedSdk.login)).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: "dev-9" }),
    );
  });

  it("embeds the presenting deviceId in the session JWT at register", async () => {
    const handler = makeApp();
    const { sdk: mockedSdk } = await import("../server/_core/sdk");
    vi.mocked(mockedSdk.register).mockResolvedValue({
      user: { id: 43, email: "n@b.com", name: null },
      sessionToken: "sess-2",
    } as never);
    const res = makeRes();
    await handler("POST", "/api/auth/register")(
      makeReq(
        { email: "n@b.com", password: "newpass123" },
        { headers: { "x-device-id": "dev-10" } },
      ),
      res,
    );
    expect(vi.mocked(mockedSdk.register)).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: "dev-10" }),
    );
  });

  it("consumes a reset token atomically — see token-consume-atomic.test.ts", async () => {
    // Real-module atomicity is covered in tests/token-consume-atomic.test.ts
    // (this file mocks ../server/db, so it cannot exercise the real path).
    // Here we assert the route rejects a token the store reports as used.
    const handler = makeApp();
    const res = makeRes();
    await handler("POST", "/api/auth/reset")(
      makeReq({ token: "usedtok", newPassword: "newpass123" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("never logs raw reset tokens", async () => {
    const handler = makeApp();
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    try {
      const { getUserByEmail } = await import("../server/db");
      vi.mocked(getUserByEmail).mockResolvedValue({ id: 42, email: "a@b.com" } as never);
      const res = makeRes();
      await handler("POST", "/api/auth/forgot")(makeReq({ email: "a@b.com" }), res);
      const uuids = logs.join("\n").match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) ?? [];
      expect(uuids).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it("ignores spoofed x-forwarded-proto without a trusted proxy", () => {
    const opts = getSessionCookieOptions({
      protocol: "http",
      hostname: "example.com",
      headers: { "x-forwarded-proto": "https" },
    } as never);
    expect(opts.secure).toBe(false);
    expect(opts.sameSite).toBe("lax");
  });
});
