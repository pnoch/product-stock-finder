import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getUserByEmail: vi.fn(),
  createEmailVerificationToken: vi.fn(),
  getEmailVerificationToken: vi.fn(),
  markEmailVerificationTokenUsed: vi.fn(),
  setUserEmailVerified: vi.fn(),
}));

vi.mock("../server/_core/sdk", () => ({
  sdk: {
    register: vi.fn(),
    login: vi.fn(),
    authenticateRequest: vi.fn(),
  },
}));

import { registerOAuthRoutes } from "../server/_core/oauth";
import * as db from "../server/db";
import { sdk } from "../server/_core/sdk";

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
  return { protocol: "https", hostname: "localhost", body, headers: {}, query: {}, ...extra } as any;
}
function makeRes() {
  const res: any = { status: vi.fn(), json: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn(), redirect: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe("POST /api/auth/resend-verification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores a hash so the emailed token can be verified", async () => {
    const handler = makeApp();
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 7, email: "a@b.com", emailVerified: false } as any);
    const res = makeRes();
    await handler("POST", "/api/auth/resend-verification")(makeReq(), res);
    expect(db.createEmailVerificationToken).toHaveBeenCalledWith(
      7,
      expect.stringMatching(/^[0-9a-f]{64}$/),
      expect.any(Number),
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe("POST /api/auth/verify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the email verified for a valid token", async () => {
    const handler = makeApp();
    vi.mocked(db.getEmailVerificationToken).mockResolvedValue({
      userId: 7,
      expiresAt: Date.now() + 10000,
      usedAt: null,
    } as any);
    const res = makeRes();
    await handler("POST", "/api/auth/verify")(makeReq({ token: "tok-123" }), res);
    expect(db.getEmailVerificationToken).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
    expect(db.setUserEmailVerified).toHaveBeenCalledWith(7);
    expect(db.markEmailVerificationTokenUsed).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("rejects invalid or expired tokens", async () => {
    const handler = makeApp();
    vi.mocked(db.getEmailVerificationToken).mockResolvedValue(null as any);
    const res = makeRes();
    await handler("POST", "/api/auth/verify")(makeReq({ token: "bad" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
