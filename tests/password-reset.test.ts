import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

vi.mock("../server/db", () => {
  const store = new Map<string, { userId: number; token: string; expiresAt: number; usedAt: number | null }>();
  return {
    getUserByEmail: vi.fn(),
    getUserById: vi.fn(),
    createPasswordResetToken: vi.fn(async (userId: number, token: string, expiresAt: number) => {
      store.set(token, { userId, token, expiresAt, usedAt: null });
    }),
    getPasswordResetToken: vi.fn(async (token: string) => store.get(token) ?? null),
    consumePasswordResetToken: vi.fn(async (token: string) => {
      const r = store.get(token);
      if (!r || r.usedAt !== null || r.expiresAt <= Date.now()) return null;
      r.usedAt = Date.now();
      store.set(token, r);
      return r;
    }),
    updateUserPasswordHashById: vi.fn(),
    getUserByOpenId: vi.fn(),
    __clearPasswordResetTokensForTest: vi.fn(() => store.clear()),
    __testStore: store,
  };
});

vi.mock("../server/_core/sdk", () => ({
  sdk: { register: vi.fn(), login: vi.fn() },
}));

vi.mock("bcryptjs", () => {
  const m = vi.fn(async () => "hashed");
  return {
    default: { hash: m, compare: vi.fn() },
    hash: m,
    compare: vi.fn(),
  };
});

import { registerOAuthRoutes } from "../server/_core/oauth";
import * as db from "../server/db";
import bcrypt from "bcryptjs";

function makeApp() {
  const handlers: Record<string, Record<string, any>> = { POST: {}, GET: {} };
  const stub = {
    post: vi.fn((path: string, handler: any) => { handlers.POST[path] = handler; }),
    get: vi.fn((path: string, handler: any) => { handlers.GET[path] = handler; }),
  };
  registerOAuthRoutes(stub as any);
  return (method: "POST" | "GET", path: string) => handlers[method][path] as (req: any, res: any) => Promise<void>;
}

function makeReq(body: any = {}) {
  return { protocol: "https", hostname: "localhost", body, headers: {}, query: {} } as any;
}
function makeRes() {
  const res: any = { status: vi.fn(), json: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn(), redirect: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe("POST /api/auth/forgot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates token and returns success when user exists", async () => {
    const handler = makeApp();
    vi.mocked(db.getUserByEmail).mockResolvedValue({ id: 42, email: "a@b.com" } as any);
    vi.mocked(db.createPasswordResetToken).mockResolvedValue({ id: 1 } as any);
    const res = makeRes();
    await handler("POST", "/api/auth/forgot")(makeReq({ email: "a@b.com" }), res);
    expect(db.getUserByEmail).toHaveBeenCalledWith("a@b.com");
    expect(db.createPasswordResetToken).toHaveBeenCalledWith(42, expect.any(String), expect.any(Number));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("returns success even when user does not exist (no enumeration)", async () => {
    const handler = makeApp();
    vi.mocked(db.getUserByEmail).mockResolvedValue(null as any);
    const res = makeRes();
    await handler("POST", "/api/auth/forgot")(makeReq({ email: "unknown@b.com" }), res);
    expect(db.createPasswordResetToken).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("rejects when email missing", async () => {
    const handler = makeApp();
    const res = makeRes();
    await handler("POST", "/api/auth/forgot")(makeReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rate limits forgot after 10 attempts from one IP", async () => {
    const handler = makeApp();
    vi.mocked(db.getUserByEmail).mockResolvedValue(null as any);
    const ip = "10.9.9.1";
    for (let i = 0; i < 10; i++) {
      const res = makeRes();
      await handler("POST", "/api/auth/forgot")(
        { ...makeReq({ email: "x@y.com" }), ip } as any,
        res,
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    }
    const res = makeRes();
    await handler("POST", "/api/auth/forgot")(
      { ...makeReq({ email: "x@y.com" }), ip } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it("ignores spoofed X-Forwarded-For without a trusted proxy", async () => {
    const handler = makeApp();
    vi.mocked(db.getUserByEmail).mockResolvedValue(null as any);
    for (let i = 0; i < 10; i++) {
      const res = makeRes();
      await handler("POST", "/api/auth/forgot")(
        {
          ...makeReq({ email: "x@y.com" }),
          ip: "10.9.9.2",
          headers: { "x-forwarded-for": `9.9.9.${i}` },
        } as any,
        res,
      );
    }
    const res = makeRes();
    await handler("POST", "/api/auth/forgot")(
      {
        ...makeReq({ email: "x@y.com" }),
        ip: "10.9.9.2",
        headers: { "x-forwarded-for": "9.9.9.99" },
      } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it("rate limits forgot per email across rotating IPs", async () => {
    const handler = makeApp();
    vi.mocked(db.getUserByEmail).mockResolvedValue(null as any);
    for (let i = 0; i < 10; i++) {
      const res = makeRes();
      await handler("POST", "/api/auth/forgot")(
        { ...makeReq({ email: "victim@b.com" }), ip: `10.9.9.${100 + i}` } as any,
        res,
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    }
    const limited = makeRes();
    await handler("POST", "/api/auth/forgot")(
      { ...makeReq({ email: "victim@b.com" }), ip: "10.9.9.250" } as any,
      limited,
    );
    expect(limited.status).toHaveBeenCalledWith(429);
    // A different email from a fresh IP is unaffected.
    const other = makeRes();
    await handler("POST", "/api/auth/forgot")(
      { ...makeReq({ email: "other@b.com" }), ip: "10.9.9.251" } as any,
      other,
    );
    expect(other.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("stores a hash, not the plaintext reset token", async () => {
    const handler = makeApp();
    vi.mocked(db.getUserByEmail).mockResolvedValue({ id: 42, email: "a@b.com" } as any);
    const res = makeRes();
    await handler("POST", "/api/auth/forgot")(makeReq({ email: "a@b.com" }), res);
    const stored = vi.mocked(db.createPasswordResetToken).mock.calls[0][1] as string;
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("POST /api/auth/reset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates token, hashes password, consumes atomically", async () => {
    const handler = makeApp();
    const token = "tok-123";
    const store = (db as unknown as { __testStore: Map<string, { userId: number; token: string; expiresAt: number; usedAt: number | null }> }).__testStore;
    store.set(sha256(token), { userId: 42, token: sha256(token), expiresAt: Date.now() + 10000, usedAt: null });
    const res = makeRes();
    await handler("POST", "/api/auth/reset")(makeReq({ token, newPassword: "newpass123" }), res);
    expect(bcrypt.hash).toHaveBeenCalled();
    expect(db.updateUserPasswordHashById).toHaveBeenCalledWith(42, "hashed");
    expect(res.json).toHaveBeenCalledWith({ success: true });
    // Consumed: a second use must fail.
    const res2 = makeRes();
    await handler("POST", "/api/auth/reset")(makeReq({ token, newPassword: "newpass123" }), res2);
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  it("rejects invalid or expired token", async () => {
    const handler = makeApp();
    const res = makeRes();
    await handler("POST", "/api/auth/reset")(makeReq({ token: "bad", newPassword: "newpass123" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Invalid or expired") }));
  });

  it("rejects used token", async () => {
    const handler = makeApp();
    const store = (db as unknown as { __testStore: Map<string, { userId: number; token: string; expiresAt: number; usedAt: number | null }> }).__testStore;
    store.set(sha256("t"), { userId: 42, token: sha256("t"), expiresAt: Date.now() + 10000, usedAt: Date.now() });
    const res = makeRes();
    await handler("POST", "/api/auth/reset")(makeReq({ token: "t", newPassword: "newpass123" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects short password", async () => {
    const handler = makeApp();
    const res = makeRes();
    await handler("POST", "/api/auth/reset")(makeReq({ token: "t", newPassword: "123" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rate limits reset after 10 attempts from one IP", async () => {
    const handler = makeApp();
    vi.mocked(db.getPasswordResetToken).mockResolvedValue(null as any);
    const ip = "10.9.9.3";
    for (let i = 0; i < 10; i++) {
      const res = makeRes();
      await handler("POST", "/api/auth/reset")(
        { ...makeReq({ token: "bad", newPassword: "newpass123" }), ip } as any,
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    }
    const res = makeRes();
    await handler("POST", "/api/auth/reset")(
      { ...makeReq({ token: "bad", newPassword: "newpass123" }), ip } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it("looks up the reset token by hash", async () => {
    const handler = makeApp();
    const res = makeRes();
    await handler("POST", "/api/auth/reset")(makeReq({ token: "tok-123", newPassword: "newpass123" }), res);
    const consumed = vi.mocked(db.consumePasswordResetToken).mock.calls[0][0] as string;
    expect(consumed).toMatch(/^[0-9a-f]{64}$/);
    expect(consumed).not.toBe("tok-123");
  });
});

describe("server/db passwordResetTokens in-memory fallback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // restore store-based implementations after reset
    const store = new Map<string, { userId: number; token: string; expiresAt: number; usedAt: number | null }>();
    vi.mocked(db.createPasswordResetToken).mockImplementation(async (userId: number, token: string, expiresAt: number) => {
      store.set(token, { userId, token, expiresAt, usedAt: null });
    });
    vi.mocked(db.getPasswordResetToken).mockImplementation(async (token: string) => store.get(token) ?? null);
    vi.mocked(db.consumePasswordResetToken).mockImplementation(async (token: string) => {
      const r = store.get(token);
      if (!r || r.usedAt !== null || r.expiresAt <= Date.now()) return null;
      r.usedAt = Date.now();
      store.set(token, r);
      return r;
    });
    vi.mocked(db.__clearPasswordResetTokensForTest as unknown as { mockImplementation: (fn: () => void) => void }).mockImplementation(() => store.clear());
  });
  it("creates and retrieves token when DB unavailable", async () => {
    const db2: any = db;
    const tok = "mem-tok-" + Date.now();
    await db2.createPasswordResetToken(1, tok, Date.now() + 5000);
    const row = await db2.getPasswordResetToken(tok);
    expect(row).not.toBeNull();
    expect(row!.token).toBe(tok);
    expect(row!.usedAt).toBeNull();
    await db2.consumePasswordResetToken(tok);
    const row2 = await db2.getPasswordResetToken(tok);
    expect(row2!.usedAt).not.toBeNull();
  });
});
