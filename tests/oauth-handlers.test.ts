import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import { encodeOAuthState } from "../shared/oauth-state";

vi.mock("../server/_core/sdk", () => ({
  sdk: {
    exchangeCodeForToken: vi.fn(),
    getUserInfo: vi.fn(),
    createSessionToken: vi.fn(),
  },
}));

vi.mock("../server/db", () => ({
  getUserByOpenId: vi.fn(async () => ({
    id: 1,
    openId: "open-1",
    name: "U",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  })),
  upsertUser: vi.fn(async () => {}),
}));

vi.mock("../server/devices", () => ({
  unrevokeDevice: vi.fn(async () => {}),
}));

import { registerOAuthRoutes } from "../server/_core/oauth";
import { sdk } from "../server/_core/sdk";
import { getUserByOpenId, upsertUser } from "../server/db";
import { unrevokeDevice } from "../server/devices";

const mockedExchange = vi.mocked(sdk.exchangeCodeForToken);
const mockedGetUserInfo = vi.mocked(sdk.getUserInfo);
const mockedCreateToken = vi.mocked(sdk.createSessionToken);
const mockedGetUser = vi.mocked(getUserByOpenId);
const mockedUpsert = vi.mocked(upsertUser);
const mockedUnrevoke = vi.mocked(unrevokeDevice);

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

const WEB_CALLBACK = "/api/oauth/callback";
const MOBILE_EXCHANGE = "/api/oauth/mobile";
const FRONTEND_URL =
  process.env.EXPO_WEB_PREVIEW_URL ||
  process.env.EXPO_PACKAGER_PROXY_URL ||
  "http://localhost:8081";

type Handler = (req: any, res: any) => Promise<void>;

function makeStubApp() {
  const handlers: Record<string, Record<string, unknown>> = { GET: {}, POST: {} };
  const stub = {
    get: vi.fn((path: string, handler: unknown) => {
      handlers.GET[path] = handler;
    }),
    post: vi.fn((path: string, handler: unknown) => {
      handlers.POST[path] = handler;
    }),
  };
  return {
    stub,
    handler(method: "GET" | "POST", path: string): Handler {
      return handlers[method][path] as Handler;
    },
  };
}

function setupRoutes() {
  const { stub, handler } = makeStubApp();
  registerOAuthRoutes(stub as any);
  return (method: "GET" | "POST", path: string) => handler(method, path);
}

function makeReq(query: Record<string, string>, headers: Record<string, string> = {}) {
  return {
    protocol: "https",
    hostname: "localhost",
    query,
    headers,
  } as any;
}

function makeRes() {
  const res: any = {
    status: vi.fn(),
    json: vi.fn(),
    cookie: vi.fn(),
    redirect: vi.fn(),
    clearCookie: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe("registerOAuthRoutes web callback (GET /api/oauth/callback)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("un-revokes the device and binds deviceId into the issued session token", async () => {
    const getHandler = setupRoutes();
    const state = encodeOAuthState("http://localhost:8081/oauth/callback", "dev-1");

    mockedExchange.mockResolvedValue({ accessToken: "at" } as any);
    mockedGetUserInfo.mockResolvedValue({ openId: "open-1", name: "U" } as any);
    mockedCreateToken.mockResolvedValue("sess-token");

    const res = makeRes();
    await getHandler("GET", WEB_CALLBACK)(makeReq({ code: "code", state }), res);

    expect(mockedUnrevoke).toHaveBeenCalledWith("dev-1");
    expect(mockedCreateToken).toHaveBeenCalledWith(
      "open-1",
      expect.objectContaining({ deviceId: "dev-1" }),
    );
    expect(res.redirect).toHaveBeenCalledWith(302, FRONTEND_URL);
    expect(res.cookie).toHaveBeenCalledWith(
      COOKIE_NAME,
      "sess-token",
      expect.objectContaining({ maxAge: expect.any(Number) }),
    );
    expect(mockedUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ openId: "open-1" }),
    );
    expect(mockedGetUser).toHaveBeenCalledWith("open-1");
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it("does not un-revoke when the state has no deviceId (legacy plain-base64)", async () => {
    const getHandler = setupRoutes();
    const state = btoa("http://localhost:8081/oauth/callback");

    mockedExchange.mockResolvedValue({ accessToken: "at" } as any);
    mockedGetUserInfo.mockResolvedValue({ openId: "open-1", name: "U" } as any);
    mockedCreateToken.mockResolvedValue("sess-token");

    const res = makeRes();
    await getHandler("GET", WEB_CALLBACK)(makeReq({ code: "code", state }), res);

    expect(mockedUnrevoke).not.toHaveBeenCalled();
    expect(mockedCreateToken).toHaveBeenCalledWith(
      "open-1",
      expect.objectContaining({ deviceId: undefined }),
    );
    expect(res.redirect).toHaveBeenCalledWith(302, FRONTEND_URL);
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it("rejects with 400 when code is missing", async () => {
    const getHandler = setupRoutes();
    const res = makeRes();
    await getHandler("GET", WEB_CALLBACK)(makeReq({ state: "x" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "code and state are required" });
    expect(mockedExchange).not.toHaveBeenCalled();
    expect(mockedCreateToken).not.toHaveBeenCalled();
    expect(mockedUnrevoke).not.toHaveBeenCalled();
  });

  it("rejects with 400 when state is missing", async () => {
    const getHandler = setupRoutes();
    const res = makeRes();
    await getHandler("GET", WEB_CALLBACK)(makeReq({ code: "code" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "code and state are required" });
    expect(mockedExchange).not.toHaveBeenCalled();
    expect(mockedCreateToken).not.toHaveBeenCalled();
    expect(mockedUnrevoke).not.toHaveBeenCalled();
  });

  it("still logs the user in when unrevokeDevice throws (failure isolation)", async () => {
    const getHandler = setupRoutes();
    const state = encodeOAuthState("http://localhost:8081/oauth/callback", "dev-1");

    mockedExchange.mockResolvedValue({ accessToken: "at" } as any);
    mockedGetUserInfo.mockResolvedValue({ openId: "open-1", name: "U" } as any);
    mockedCreateToken.mockResolvedValue("sess-token");
    mockedUnrevoke.mockRejectedValue(new Error("db down"));

    const res = makeRes();
    await getHandler("GET", WEB_CALLBACK)(makeReq({ code: "code", state }), res);

    expect(mockedCreateToken).toHaveBeenCalledWith(
      "open-1",
      expect.objectContaining({ deviceId: "dev-1" }),
    );
    expect(res.redirect).toHaveBeenCalledWith(302, FRONTEND_URL);
    expect(res.cookie).toHaveBeenCalledWith(
      COOKIE_NAME,
      "sess-token",
      expect.objectContaining({ maxAge: expect.any(Number) }),
    );
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it("responds 500 when the exchange fails", async () => {
    const getHandler = setupRoutes();
    const state = encodeOAuthState("http://localhost:8081/oauth/callback", "dev-1");

    mockedExchange.mockRejectedValue(new Error("boom"));

    const res = makeRes();
    await getHandler("GET", WEB_CALLBACK)(makeReq({ code: "code", state }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "OAuth callback failed" });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[OAuth] Callback failed",
      expect.any(Error),
    );
    expect(mockedCreateToken).not.toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });
});

describe("registerOAuthRoutes mobile exchange (GET /api/oauth/mobile)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("un-revokes the device, binds deviceId, and returns the session token", async () => {
    const getHandler = setupRoutes();
    const state = encodeOAuthState("http://localhost:8081/oauth/callback", "dev-1");

    mockedExchange.mockResolvedValue({ accessToken: "at" } as any);
    mockedGetUserInfo.mockResolvedValue({ openId: "open-1", name: "U" } as any);
    mockedCreateToken.mockResolvedValue("sess-token");

    const res = makeRes();
    await getHandler("GET", MOBILE_EXCHANGE)(makeReq({ code: "code", state }), res);

    expect(mockedUnrevoke).toHaveBeenCalledWith("dev-1");
    expect(mockedCreateToken).toHaveBeenCalledWith(
      "open-1",
      expect.objectContaining({ deviceId: "dev-1" }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        app_session_id: "sess-token",
        user: expect.objectContaining({ openId: "open-1" }),
      }),
    );
    expect(mockedUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ openId: "open-1" }),
    );
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it("still returns the session token when unrevokeDevice throws", async () => {
    const getHandler = setupRoutes();
    const state = encodeOAuthState("http://localhost:8081/oauth/callback", "dev-1");

    mockedExchange.mockResolvedValue({ accessToken: "at" } as any);
    mockedGetUserInfo.mockResolvedValue({ openId: "open-1", name: "U" } as any);
    mockedCreateToken.mockResolvedValue("sess-token");
    mockedUnrevoke.mockRejectedValue(new Error("db down"));

    const res = makeRes();
    await getHandler("GET", MOBILE_EXCHANGE)(makeReq({ code: "code", state }), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ app_session_id: "sess-token" }),
    );
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it("responds 500 when the exchange fails", async () => {
    const getHandler = setupRoutes();
    const state = encodeOAuthState("http://localhost:8081/oauth/callback", "dev-1");

    mockedExchange.mockRejectedValue(new Error("boom"));

    const res = makeRes();
    await getHandler("GET", MOBILE_EXCHANGE)(makeReq({ code: "code", state }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "OAuth mobile exchange failed" });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[OAuth] Mobile exchange failed",
      expect.any(Error),
    );
    expect(mockedCreateToken).not.toHaveBeenCalled();
  });

  it("rejects with 400 when code is missing", async () => {
    const getHandler = setupRoutes();
    const res = makeRes();
    await getHandler("GET", MOBILE_EXCHANGE)(makeReq({ state: "x" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "code and state are required" });
    expect(mockedExchange).not.toHaveBeenCalled();
  });

  it("rejects with 400 when state is missing", async () => {
    const getHandler = setupRoutes();
    const res = makeRes();
    await getHandler("GET", MOBILE_EXCHANGE)(makeReq({ code: "code" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "code and state are required" });
    expect(mockedExchange).not.toHaveBeenCalled();
  });
});
