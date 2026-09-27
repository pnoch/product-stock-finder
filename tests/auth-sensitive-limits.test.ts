import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/_core/sdk", () => ({
  sdk: {
    register: vi.fn(),
    login: vi.fn(),
    createSessionToken: vi.fn(),
    authenticateRequest: vi.fn(async () => ({ id: 9 })),
  },
}));

vi.mock("../server/db", () => ({
  // Memory path: the request context now checks the user's "*" revocation,
  // which needs the device store rather than the DB.
  getDb: vi.fn(async () => null),
  getUserByOpenId: vi.fn(async () => null),
  upsertUser: vi.fn(async () => {}),
  getUserByEmail: vi.fn(async () => null),
  getUserById: vi.fn(async () => ({ id: 9, passwordHash: "hashed" })),
  createPasswordResetToken: vi.fn(async () => {}),
  consumePasswordResetToken: vi.fn(async () => null),
  createEmailVerificationToken: vi.fn(async () => {}),
  consumeEmailVerificationToken: vi.fn(async () => null),
  updateUserPasswordHashById: vi.fn(async () => {}),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(async () => false),
    hash: vi.fn(async () => "hashed"),
  },
  compare: vi.fn(async () => false),
  hash: vi.fn(async () => "hashed"),
}));

import { registerOAuthRoutes } from "../server/_core/oauth";
import { sdk } from "../server/_core/sdk";

type Handler = (req: any, res: any) => Promise<void>;

function routeHandler(path: string): Handler {
  const handlers: Record<string, unknown> = {};
  const stub = {
    get: vi.fn(),
    post: vi.fn((p: string, h: unknown) => {
      handlers[p] = h;
    }),
  };
  registerOAuthRoutes(stub as any);
  return handlers[path] as Handler;
}

function reqRes(ip: string, body: Record<string, unknown> = {}) {
  const res: any = { statusCode: 200, body: null as unknown };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  });
  const req: any = {
    headers: {},
    ip,
    socket: { remoteAddress: ip },
    body,
    app: { get: () => undefined },
  };
  return { req, res };
}

describe("auth sensitive-route limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throttles login per account, not only per source IP", async () => {
    const handler = routeHandler("/api/auth/login");
    let lastCode = 0;
    for (let i = 0; i < 11; i++) {
      // Distinct IPs: the per-IP bucket never trips, so only the per-account
      // bucket can stop a distributed credential spray.
      const { req, res } = reqRes(`10.1.0.${i}`, {
        email: "victim@example.com",
        password: "guess",
      });
      await handler(req, res);
      lastCode = res.statusCode;
    }
    expect(lastCode).toBe(429);
  });

  it("clamps an oversized x-device-id before it becomes a session claim", async () => {
    const handler = routeHandler("/api/auth/login");
    const { req, res } = reqRes("12.0.0.9", {
      email: "someone@example.com",
      password: "x",
    });
    req.headers = { "x-device-id": "d".repeat(5000) };
    await handler(req, res);
    const arg = vi.mocked(sdk.login).mock.calls[0]?.[0] as
      | { deviceId?: string }
      | undefined;
    // Unbounded, the claim overflowed the varchar(128) device columns later.
    expect(arg?.deviceId?.length).toBe(128);
  });

  it("throttles change-password brute force per IP", async () => {
    const handler = routeHandler("/api/auth/change-password");
    let lastCode = 0;
    for (let i = 0; i < 11; i++) {
      const { req, res } = reqRes("12.0.0.1", {
        currentPassword: "wrong",
        newPassword: "newpass1",
      });
      await handler(req, res);
      lastCode = res.statusCode;
    }
    expect(lastCode).toBe(429);
  });

  it("throttles change-password per user across rotating IPs", async () => {
    const handler = routeHandler("/api/auth/change-password");
    let lastCode = 0;
    for (let i = 0; i < 11; i++) {
      const { req, res } = reqRes(`12.0.1.${i}`, {
        currentPassword: "wrong",
        newPassword: "newpass1",
      });
      await handler(req, res);
      lastCode = res.statusCode;
    }
    expect(lastCode).toBe(429);
  });

  it("throttles resend-verification per user across rotating IPs", async () => {
    const handler = routeHandler("/api/auth/resend-verification");
    let lastCode = 0;
    for (let i = 0; i < 11; i++) {
      const { req, res } = reqRes(`12.0.2.${i}`);
      await handler(req, res);
      lastCode = res.statusCode;
    }
    expect(lastCode).toBe(429);
  });
});
