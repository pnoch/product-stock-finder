import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getUserByEmail: vi.fn(),
  upsertUser: vi.fn(),
  updateUserPasswordHash: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

vi.mock("../server/_core/sdk", () => ({
  sdk: {
    register: vi.fn(),
    login: vi.fn(),
    authenticateRequest: vi.fn(),
    createSessionToken: vi.fn(),
  },
}));

vi.mock("bcryptjs", () => {
  const hash = vi.fn(async () => "hashed");
  return { default: { hash, compare: vi.fn() }, hash, compare: vi.fn() };
});

import { registerOAuthRoutes } from "../server/_core/oauth";
import { sdk } from "../server/_core/sdk";

function makeApp() {
  const handlers: Record<string, Record<string, any>> = { POST: {}, GET: {} };
  const stub = {
    post: vi.fn((path: string, handler: any) => {
      handlers.POST[path] = handler;
    }),
    get: vi.fn((path: string, handler: any) => {
      handlers.GET[path] = handler;
    }),
  };
  registerOAuthRoutes(stub as any);
  return (method: "POST" | "GET", path: string) =>
    handlers[method][path] as (req: any, res: any) => Promise<void>;
}

function makeReq(body: any = {}) {
  return {
    protocol: "https",
    hostname: "localhost",
    body,
    headers: {},
    query: {},
    ip: "10.0.0.1",
  } as any;
}

function makeRes() {
  const res: any = {
    status: vi.fn(),
    json: vi.fn(),
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    redirect: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe("auth error responses never leak internals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("register: replaces a raw driver error with a generic message", async () => {
    vi.mocked(sdk.register).mockRejectedValue(
      new Error("ER_DUP_ENTRY: Duplicate entry 'x' for key 'users.email'"),
    );
    const handler = makeApp();
    const res = makeRes();
    await handler("POST", "/api/auth/register")(
      makeReq({ email: "a@b.com", password: "secret123" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Registration failed" });
  });

  it("register: still surfaces a deliberate HttpError message", async () => {
    const { ForbiddenError } = await import("../shared/_core/errors");
    vi.mocked(sdk.register).mockRejectedValue(
      ForbiddenError("Email already registered"),
    );
    const handler = makeApp();
    const res = makeRes();
    await handler("POST", "/api/auth/register")(
      makeReq({ email: "a@b.com", password: "secret123" }),
      res,
    );
    expect(res.json).toHaveBeenCalledWith({
      error: "Email already registered",
    });
  });

  it("login: replaces a raw driver error with a generic message", async () => {
    vi.mocked(sdk.login).mockRejectedValue(
      new Error("connect ECONNREFUSED 127.0.0.1:3306"),
    );
    const handler = makeApp();
    const res = makeRes();
    await handler("POST", "/api/auth/login")(
      makeReq({ email: "a@b.com", password: "secret123" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Login failed" });
  });

  it("login: still surfaces the deliberate invalid-credentials message", async () => {
    const { ForbiddenError } = await import("../shared/_core/errors");
    vi.mocked(sdk.login).mockRejectedValue(
      ForbiddenError("Invalid email or password"),
    );
    const handler = makeApp();
    const res = makeRes();
    await handler("POST", "/api/auth/login")(
      makeReq({ email: "a@b.com", password: "wrong" }),
      res,
    );
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid email or password",
    });
  });
});
