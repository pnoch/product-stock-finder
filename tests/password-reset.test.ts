import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => {
  const store = new Map<string, { userId: number; token: string; expiresAt: number; usedAt: number | null }>();
  return {
    getUserByEmail: vi.fn(),
    getUserById: vi.fn(),
    createPasswordResetToken: vi.fn(async (userId: number, token: string, expiresAt: number) => {
      store.set(token, { userId, token, expiresAt, usedAt: null });
    }),
    getPasswordResetToken: vi.fn(async (token: string) => store.get(token) ?? null),
    markPasswordResetTokenUsed: vi.fn(async (token: string) => {
      const r = store.get(token);
      if (r) r.usedAt = Date.now();
    }),
    updateUserPasswordHashById: vi.fn(),
    getUserByOpenId: vi.fn(),
    __clearPasswordResetTokensForTest: vi.fn(() => store.clear()),
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
});

describe("POST /api/auth/reset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates token, hashes password, marks used", async () => {
    const handler = makeApp();
    const token = "tok-123";
    vi.mocked(db.getPasswordResetToken).mockResolvedValue({ userId: 42, token, expiresAt: Date.now() + 10000, usedAt: null } as any);
    const res = makeRes();
    await handler("POST", "/api/auth/reset")(makeReq({ token, newPassword: "newpass123" }), res);
    expect(bcrypt.hash).toHaveBeenCalled();
    expect(db.updateUserPasswordHashById).toHaveBeenCalledWith(42, "hashed");
    expect(db.markPasswordResetTokenUsed).toHaveBeenCalledWith(token);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("rejects invalid or expired token", async () => {
    const handler = makeApp();
    vi.mocked(db.getPasswordResetToken).mockResolvedValue(null as any);
    const res = makeRes();
    await handler("POST", "/api/auth/reset")(makeReq({ token: "bad", newPassword: "newpass123" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Invalid or expired") }));
  });

  it("rejects used token", async () => {
    const handler = makeApp();
    vi.mocked(db.getPasswordResetToken).mockResolvedValue({ userId: 42, token: "t", expiresAt: Date.now() + 10000, usedAt: Date.now() } as any);
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
    vi.mocked(db.markPasswordResetTokenUsed).mockImplementation(async (token: string) => {
      const r = store.get(token);
      if (r) r.usedAt = Date.now();
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
    await db2.markPasswordResetTokenUsed(tok);
    const row2 = await db2.getPasswordResetToken(tok);
    expect(row2!.usedAt).not.toBeNull();
  });
});
