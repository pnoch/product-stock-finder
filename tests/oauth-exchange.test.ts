import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  // The OAuth callback/consume now lift the user's wildcard revocation via
  // unrevokeDevice, which needs getDb (null -> the in-memory branch).
  getDb: vi.fn(async () => null),
  getUserByEmail: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
  createEmailVerificationToken: vi.fn(),
  getPasswordResetToken: vi.fn(),
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
  oauthStateNonce,
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

describe("GET /api/auth/oauth/start", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sanitizes the redirectUri before signing it into state", async () => {
    const handler = makeApp();
    const res = makeRes();
    await handler("GET", "/api/auth/oauth/start")(
      makeReq({ provider: "google", redirectUri: "https://evil.com/steal" }),
      res,
    );
    const url: string = res.json.mock.calls[0][0].url;
    const state = new URL(url, "https://app.local").searchParams.get("state")!;
    const parsed = verifyOAuthState(state);
    expect(parsed).not.toBeNull();
    expect(parsed!.redirectUri).toBe("/");
  });

  it("binds the state nonce to the browser with a short-lived cookie", async () => {
    const handler = makeApp();
    const res = makeRes();
    await handler("GET", "/api/auth/oauth/start")(
      makeReq({ provider: "google" }),
      res,
    );
    const url: string = res.json.mock.calls[0][0].url;
    const state = new URL(url, "https://app.local").searchParams.get("state")!;
    const nonce = oauthStateNonce(state);
    expect(nonce).not.toBeNull();
    // The callback requires this cookie (login-CSRF guard); if /start stops
    // setting it, every web OAuth login breaks.
    const cookieCall = vi.mocked(res.cookie).mock.calls.find(
      (call: unknown[]) => call[0] === "psf_oauth_state",
    );
    expect(cookieCall?.[1]).toBe(nonce);
    expect(vi.mocked(res.cookie).mock.calls[0]?.[2]).toMatchObject({
      httpOnly: true,
      maxAge: expect.any(Number),
    });
  });

  it("uses a SameSite=None cookie for Apple, whose callback is a cross-site POST", async () => {
    process.env.APPLE_CLIENT_ID = "test-apple-id";
    process.env.APPLE_TEAM_ID = "TEAMID1234";
    process.env.APPLE_KEY_ID = "KEYID12345";
    try {
      const handler = makeApp();
      const res = makeRes();
      await handler("GET", "/api/auth/oauth/start")(
        makeReq({ provider: "apple" }),
        res,
      );
      // Apple posts the authorization response cross-site, where a Lax cookie is
      // not sent at all — the guard would reject every Apple web login.
      expect(vi.mocked(res.cookie).mock.calls[0]?.[2]).toMatchObject({
        sameSite: "none",
        secure: true,
      });
    } finally {
      delete process.env.APPLE_CLIENT_ID;
      delete process.env.APPLE_TEAM_ID;
      delete process.env.APPLE_KEY_ID;
    }
  });

  it("rate limits repeated start requests from one IP", async () => {
    const handler = makeApp();
    for (let i = 0; i < 10; i++) {
      const res = makeRes();
      await handler("GET", "/api/auth/oauth/start")(
        makeReq({ provider: "google" }, {}, { ip: "10.9.9.31" }),
        res,
      );
      expect(res.json).toHaveBeenCalled();
    }
    const res = makeRes();
    await handler("GET", "/api/auth/oauth/start")(
      makeReq({ provider: "google" }, {}, { ip: "10.9.9.31" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it("rate limits repeated consume attempts from one IP", async () => {
    const handler = makeApp();
    for (let i = 0; i < 10; i++) {
      const res = makeRes();
      await handler("POST", "/api/auth/oauth/consume")(
        makeReq({}, { ticket: "nope", deviceId: "d" }, { ip: "10.9.9.32" }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    }
    const res = makeRes();
    await handler("POST", "/api/auth/oauth/consume")(
      makeReq({}, { ticket: "nope", deviceId: "d" }, { ip: "10.9.9.32" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(429);
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

  it("rejects a web callback that does not echo the state cookie", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-google-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
    const handler = makeApp();
    const state = signOAuthState({ redirectUri: "/", provider: "google" });
    const res = makeRes();
    await handler("GET", "/api/oauth/callback")(
      makeReq({ code: "auth-code", state }),
      res,
    );
    // Without the browser-bound nonce cookie, a captured callback URL must not
    // be able to install the attacker's session in the victim's browser.
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining("error=invalid_state"),
    );
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
        // The state nonce must be echoed in the binding cookie (login-CSRF).
        makeReq(
          { code: "auth-code", state },
          {},
          { headers: { cookie: `psf_oauth_state=${oauthStateNonce(state)}` } },
        ),
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
