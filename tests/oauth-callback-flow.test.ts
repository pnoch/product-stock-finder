import { describe, it, expect, vi } from "vitest";

vi.mock("../server/db", () => ({
  getUserByEmail: vi.fn(),
}));

vi.mock("../server/_core/sdk", () => ({
  sdk: { register: vi.fn(), login: vi.fn(), authenticateRequest: vi.fn() },
}));

import { registerOAuthRoutes } from "../server/_core/oauth";

function makeApp() {
  const handlers: Record<string, Record<string, any>> = { POST: {}, GET: {} };
  const stub = {
    post: vi.fn((path: string, handler: any) => { handlers.POST[path] = handler; }),
    get: vi.fn((path: string, handler: any) => { handlers.GET[path] = handler; }),
  };
  registerOAuthRoutes(stub as any);
  return (method: "POST" | "GET", path: string) => handlers[method][path] as (req: any, res: any) => Promise<void>;
}

function makeReq(query: any = {}) {
  return { protocol: "https", hostname: "localhost", body: {}, headers: {}, query } as any;
}
function makeRes() {
  const res: any = { status: vi.fn(), json: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn(), redirect: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe("GET /api/oauth/callback", () => {
  it("preserves code and state instead of dropping them", async () => {
    const handler = makeApp();
    const res = makeRes();
    await handler("GET", "/api/oauth/callback")(
      makeReq({ code: "auth-code", state: "state-123" }),
      res,
    );
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining("code=auth-code"),
    );
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining("state=state-123"),
    );
  });

  it("forwards provider errors instead of dropping them", async () => {
    const handler = makeApp();
    const res = makeRes();
    await handler("GET", "/api/oauth/callback")(
      makeReq({ error: "access_denied" }),
      res,
    );
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining("error=access_denied"),
    );
  });
});

describe("GET /api/auth/oauth/providers", () => {
  it("reports which social providers are configured", async () => {
    const handler = makeApp();
    const res = makeRes();
    await handler("GET", "/api/auth/oauth/providers")(makeReq(), res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ google: expect.any(Boolean), apple: expect.any(Boolean) }),
    );
  });
});
