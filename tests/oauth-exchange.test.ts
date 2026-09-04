import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getUserByEmail: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
  createEmailVerificationToken: vi.fn(),
  getPasswordResetToken: vi.fn(),
  markPasswordResetTokenUsed: vi.fn(),
  updateUserPasswordHashById: vi.fn(),
}));

vi.mock("../server/_core/sdk", () => ({
  sdk: {
    register: vi.fn(),
    login: vi.fn(),
    authenticateRequest: vi.fn(),
    createSessionToken: vi.fn(async () => "sess-123"),
  },
}));

import {
  registerOAuthRoutes,
  signOAuthState,
  verifyOAuthState,
} from "../server/_core/oauth";
import * as db from "../server/db";

function makeApp() {
  const handlers: Record<string, Record<string, any>> = { POST: {}, GET: {} };
  const stub = {
    post: vi.fn((path: string, handler: any) => { handlers.POST[path] = handler; }),
    get: vi.fn((path: string, handler: any) => { handlers.GET[path] = handler; }),
  };
  registerOAuthRoutes(stub as any);
  return (method: "POST" | "GET", path: string) => handlers[method][path] as (req: any, res: any) => Promise<void>;
}

function makeReq(query: any = {}, body: any = {}, extra: any = {}) {
  return { protocol: "https", hostname: "localhost", body, headers: {}, query, ...extra } as any;
}
function makeRes() {
  const res: any = {
    status: vi.fn(), json: vi.fn(), cookie: vi.fn(),
    clearCookie: vi.fn(), redirect: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe("OAuth state envelope", () => {
  it("round-trips through sign and verify", () => {
    const state = signOAuthState({ redirectUri: "/", deviceId: "d1", provider: "google" });
    const parsed = verifyOAuthState(state);
    expect(parsed).toMatchObject({ redirectUri: "/", deviceId: "d1", provider: "google" });
  });

  it("rejects tampered states", () => {
    const state = signOAuthState({ redirectUri: "/", provider: "google" });
    const tampered = state.slice(0, -4) + "AAAA";
    expect(verifyOAuthState(tampered)).toBeNull();
  });

  it("rejects expired states", () => {
    const state = signOAuthState(
      { redirectUri: "/", provider: "google" },
      -60_000,
    );
    expect(verifyOAuthState(state)).toBeNull();
  });
});

describe("GET /api/oauth/callback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unsigned/forged state instead of completing login", async () => {
    const handler = makeApp();
    const res = makeRes();
    await handler("GET", "/api/oauth/callback")(
      makeReq({ code: "auth-code", state: "forged-state" }),
      res,
    );
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining("error="),
    );
    expect(db.upsertUser).not.toHaveBeenCalled();
  });

  it("exchanges a Google code and sets a session cookie for web", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-google-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { ok: true, json: async () => ({ access_token: "at-1", expires_in: 3600 }) };
      }
      return {
        ok: true,
        json: async () => ({ sub: "google-1", email: "g@example.com", name: "G User" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      vi.mocked(db.getUserByEmail).mockResolvedValue(null as any);
      vi.mocked(db.getUserByOpenId).mockResolvedValue({
        id: 7, openId: "google:google-1", email: "g@example.com",
      } as any);
      const handler = makeApp();
      const state = signOAuthState({ redirectUri: "/", provider: "google" });
      const res = makeRes();
      await handler("GET", "/api/oauth/callback")(
        makeReq({ code: "auth-code", state }),
        res,
      );
      expect(db.upsertUser).toHaveBeenCalledWith(
        expect.objectContaining({ openId: "google:google-1", loginMethod: "google" }),
      );
      expect(res.cookie).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(302, "/");
    } finally {
      vi.unstubAllGlobals();
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
    }
  });

  it("issues a device-bound ticket for native flows", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-google-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { ok: true, json: async () => ({ access_token: "at-1", expires_in: 3600 }) };
      }
      return {
        ok: true,
        json: async () => ({ sub: "google-1", email: "g@example.com", name: "G User" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      vi.mocked(db.getUserByEmail).mockResolvedValue(null as any);
      vi.mocked(db.getUserByOpenId).mockResolvedValue({ id: 7 } as any);
      const handler = makeApp();
      const state = signOAuthState({ redirectUri: "", deviceId: "dev-9", provider: "google" });
      const res = makeRes();
      await handler("GET", "/api/oauth/callback")(
        makeReq({ code: "auth-code", state }),
        res,
      );
      const redirectUrl: string = res.redirect.mock.calls[0][1];
      expect(redirectUrl).toContain("productstockfinder:/oauth/callback?ticket=");
    } finally {
      vi.unstubAllGlobals();
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
    }
  });
});

describe("POST /api/auth/oauth/consume", () => {
  beforeEach(() => vi.clearAllMocks());

  async function issueTicket(deviceId = "dev-9"): Promise<string> {
    process.env.GOOGLE_CLIENT_ID = "test-google-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { ok: true, json: async () => ({ access_token: "at-1", expires_in: 3600 }) };
      }
      return {
        ok: true,
        json: async () => ({ sub: "google-1", email: "g@example.com", name: "G User" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      vi.mocked(db.getUserByEmail).mockResolvedValue(null as any);
      vi.mocked(db.getUserByOpenId).mockResolvedValue({
        id: 7, openId: "google:google-1", email: "g@example.com", name: "G User",
      } as any);
      const handler = makeApp();
      const state = signOAuthState({ redirectUri: "", deviceId, provider: "google" });
      const res = makeRes();
      await handler("GET", "/api/oauth/callback")(
        makeReq({ code: "auth-code", state }),
        res,
      );
      const redirectUrl: string = res.redirect.mock.calls[0][1];
      return new URL(redirectUrl.replace("productstockfinder:/", "https://app.local/")).searchParams.get("ticket")!;
    } finally {
      vi.unstubAllGlobals();
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
    }
  }

  it("redeems a valid ticket once for the bound device", async () => {
    const handler = makeApp();
    const ticket = await issueTicket("dev-9");
    const res = makeRes();
    await handler("POST", "/api/auth/oauth/consume")(
      makeReq({}, { ticket, deviceId: "dev-9" }),
      res,
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ sessionToken: "sess-123" }),
    );
    const res2 = makeRes();
    await handler("POST", "/api/auth/oauth/consume")(
      makeReq({}, { ticket, deviceId: "dev-9" }),
      res2,
    );
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  it("rejects redemption from a different device", async () => {
    const handler = makeApp();
    const ticket = await issueTicket("dev-9");
    const res = makeRes();
    await handler("POST", "/api/auth/oauth/consume")(
      makeReq({}, { ticket, deviceId: "attacker-device" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
