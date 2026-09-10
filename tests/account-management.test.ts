import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  getUserByOpenId: vi.fn(),
  updateUserPasswordHashById: vi.fn(),
  deleteUserById: vi.fn(),
  getPasswordResetToken: vi.fn(),
  createPasswordResetToken: vi.fn(),
  updateUserPasswordHash: vi.fn(),
  __clearPasswordResetTokensForTest: vi.fn(),
}));

vi.mock("../server/_core/sdk", () => ({
  sdk: {
    register: vi.fn(),
    login: vi.fn(),
    authenticateRequest: vi.fn(),
  },
}));

vi.mock("bcryptjs", () => {
  return {
    default: { hash: vi.fn(async () => "hashed"), compare: vi.fn(async () => true) },
    hash: vi.fn(async () => "hashed"),
    compare: vi.fn(async () => true),
  };
});

import { registerOAuthRoutes } from "../server/_core/oauth";
import * as db from "../server/db";
import { sdk } from "../server/_core/sdk";
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

function makeReq(body: any = {}, headers: any = {}) {
  return { protocol: "https", hostname: "localhost", body, headers, query: {} } as any;
}
function makeRes() {
  const res: any = { status: vi.fn(), json: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn(), redirect: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe("POST /api/auth/change-password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("changes password when current is correct", async () => {
    const handler = makeApp();
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 1, openId: "open_1" } as any);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 1, passwordHash: "oldhash" } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(bcrypt.hash).mockResolvedValue("newhashed" as never);
    const res = makeRes();
    await handler("POST", "/api/auth/change-password")(makeReq({ currentPassword: "oldpass", newPassword: "newpass123" }), res);
    expect(db.updateUserPasswordHashById).toHaveBeenCalledWith(1, "newhashed");
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("rejects when current password is incorrect", async () => {
    const handler = makeApp();
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 1, openId: "open_1" } as any);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 1, passwordHash: "oldhash" } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    const res = makeRes();
    await handler("POST", "/api/auth/change-password")(makeReq({ currentPassword: "wrong", newPassword: "newpass123" }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Current password") }));
  });

  it("rejects when not authenticated", async () => {
    const handler = makeApp();
    vi.mocked(sdk.authenticateRequest).mockRejectedValue(new Error("Invalid session cookie"));
    const res = makeRes();
    await handler("POST", "/api/auth/change-password")(makeReq({ currentPassword: "old", newPassword: "newpass123" }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects short new password", async () => {
    const handler = makeApp();
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 1, openId: "open_1" } as any);
    const res = makeRes();
    await handler("POST", "/api/auth/change-password")(makeReq({ currentPassword: "oldpass", newPassword: "123" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects missing currentPassword", async () => {
    const handler = makeApp();
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 1, openId: "open_1" } as any);
    const res = makeRes();
    await handler("POST", "/api/auth/change-password")(makeReq({ newPassword: "newpass123" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("POST /api/auth/delete-account", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes account when confirm DELETE", async () => {
    const handler = makeApp();
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 42, openId: "open_42" } as any);
    const res = makeRes();
    await handler("POST", "/api/auth/delete-account")(makeReq({ confirm: "DELETE" }), res);
    expect(db.deleteUserById).toHaveBeenCalledWith(42);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it("rejects when confirm is not DELETE", async () => {
    const handler = makeApp();
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 1, openId: "open_1" } as any);
    const res = makeRes();
    await handler("POST", "/api/auth/delete-account")(makeReq({ confirm: "NO" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.deleteUserById).not.toHaveBeenCalled();
  });

  it("rejects when not authenticated", async () => {
    const handler = makeApp();
    vi.mocked(sdk.authenticateRequest).mockRejectedValue(new Error("Invalid session cookie"));
    const res = makeRes();
    await handler("POST", "/api/auth/delete-account")(makeReq({ confirm: "DELETE" }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns Verified badge logic (emailVerified)", async () => {
    // sanity check buildUserResponse includes emailVerified
    const handler = makeApp();
    // register flow is via sdk, but we check that oauth me returns emailVerified
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 1, emailVerified: 1 } as any);
    // /api/auth/me uses sdk.authenticateRequest
    const res = makeRes();
    const h = handler("GET", "/api/auth/me");
    // h is the me handler
    await h(makeReq(), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ emailVerified: true }) }));
  });
});
