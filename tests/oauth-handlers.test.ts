import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { COOKIE_NAME } from "../shared/const";

vi.mock("../server/_core/sdk", () => ({
  sdk: {
    register: vi.fn(),
    login: vi.fn(),
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
    passwordHash: null,
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  })),
  getUserByEmail: vi.fn(async () => null),
  linkUserOpenIdByEmail: vi.fn(async () => {}),
  upsertUser: vi.fn(async () => {}),
}));

import { registerOAuthRoutes, signOAuthState } from "../server/_core/oauth";
import { sdk } from "../server/_core/sdk";
import { getUserByOpenId, upsertUser } from "../server/db";

const mockedRegister = vi.mocked(sdk.register);
const mockedLogin = vi.mocked(sdk.login);
const mockedCreateToken = vi.mocked(sdk.createSessionToken);
const mockedGetUser = vi.mocked(getUserByOpenId);
const mockedUpsert = vi.mocked(upsertUser);

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

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

function makeReq(body: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return {
    protocol: "https",
    hostname: "localhost",
    body,
    headers,
    query: {},
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

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers a new user and returns session token", async () => {
    const postHandler = setupRoutes();
    mockedRegister.mockResolvedValue({
      user: { id: 1, email: "test@example.com", name: "Test", openId: "open-1" },
      sessionToken: "sess-token",
    });

    const res = makeRes();
    await postHandler("POST", "/api/auth/register")(
      makeReq({ email: "test@example.com", password: "password123" }),
      res,
    );

    expect(mockedRegister).toHaveBeenCalledWith({ email: "test@example.com", password: "password123", name: undefined });
    expect(res.cookie).toHaveBeenCalledWith(COOKIE_NAME, "sess-token", expect.objectContaining({ maxAge: expect.any(Number) }));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ openId: "open-1" }),
        sessionToken: "sess-token",
      }),
    );
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it("rejects with 400 when email is missing", async () => {
    const postHandler = setupRoutes();
    const res = makeRes();
    await postHandler("POST", "/api/auth/register")(
      makeReq({ password: "password123" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "email and password are required" });
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it("rejects with 400 when password is too short", async () => {
    const postHandler = setupRoutes();
    const res = makeRes();
    await postHandler("POST", "/api/auth/register")(
      makeReq({ email: "test@example.com", password: "123" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "password must be at least 6 characters" });
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it("returns 400 when registration fails (duplicate email)", async () => {
    const postHandler = setupRoutes();
    const { ForbiddenError } = await import("../shared/_core/errors");
    mockedRegister.mockRejectedValue(ForbiddenError("Email already registered"));

    const res = makeRes();
    await postHandler("POST", "/api/auth/register")(
      makeReq({ email: "test@example.com", password: "password123" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Email already registered" });
  });

  it("hides a raw driver error behind a generic message", async () => {
    const postHandler = setupRoutes();
    mockedRegister.mockRejectedValue(
      new Error("ER_DUP_ENTRY: Duplicate entry 'x' for key 'users.email'"),
    );

    const res = makeRes();
    await postHandler("POST", "/api/auth/register")(
      makeReq({ email: "test@example.com", password: "password123" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Registration failed" });
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs in and returns session token", async () => {
    const postHandler = setupRoutes();
    mockedLogin.mockResolvedValue({
      user: { id: 1, email: "test@example.com", name: "Test", openId: "open-1" },
      sessionToken: "sess-token",
    });

    const res = makeRes();
    await postHandler("POST", "/api/auth/login")(
      makeReq({ email: "test@example.com", password: "password123" }),
      res,
    );

    expect(mockedLogin).toHaveBeenCalledWith({ email: "test@example.com", password: "password123" });
    expect(res.cookie).toHaveBeenCalledWith(COOKIE_NAME, "sess-token", expect.objectContaining({ maxAge: expect.any(Number) }));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ openId: "open-1" }),
        sessionToken: "sess-token",
      }),
    );
    expect(res.status).not.toHaveBeenCalledWith(401);
  });

  it("rejects with 400 when email is missing", async () => {
    const postHandler = setupRoutes();
    const res = makeRes();
    await postHandler("POST", "/api/auth/login")(
      makeReq({ password: "password123" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "email and password are required" });
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it("returns 401 on invalid credentials", async () => {
    const postHandler = setupRoutes();
    const { ForbiddenError } = await import("../shared/_core/errors");
    mockedLogin.mockRejectedValue(ForbiddenError("Invalid email or password"));

    const res = makeRes();
    await postHandler("POST", "/api/auth/login")(
      makeReq({ email: "test@example.com", password: "wrong" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid email or password" });
  });

  it("hides a raw driver error behind a generic login message", async () => {
    const postHandler = setupRoutes();
    mockedLogin.mockRejectedValue(
      new Error("connect ECONNREFUSED 127.0.0.1:3306"),
    );

    const res = makeRes();
    await postHandler("POST", "/api/auth/login")(
      makeReq({ email: "test@example.com", password: "password123" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Login failed" });
  });
});

describe("GET /api/oauth/callback (legacy redirect)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects callback requests without valid signed state", async () => {
    const getHandler = setupRoutes();
    const res = makeRes();
    await getHandler("GET", "/api/oauth/callback")(makeReq({}), res);
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining("error=invalid_state"),
    );
  });
});

describe("GET /api/oauth/callback (web ticket redirect)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects the ticket to a same-origin web redirectUri", async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://app.example.com";
    process.env.GOOGLE_CLIENT_ID = "test-google-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { ok: true, json: async () => ({ access_token: "at-1" }) };
      }
      return {
        ok: true,
        json: async () => ({ sub: "google-1", email: "g@example.com", name: "G User" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      mockedGetUser.mockResolvedValue({ id: 7 } as any);
      mockedCreateToken.mockResolvedValue("sess-123" as any);
      const getHandler = setupRoutes();
      const webBase = "https://app.example.com";
      const state = signOAuthState(
        { redirectUri: `${webBase}/#/oauth/callback`, deviceId: "dev-9", provider: "google" },
      );
      const res = makeRes();
      const req: any = {
        ...makeReq({}),
        query: { code: "auth-code", state },
        ip: "10.9.9.101",
      };
      await getHandler("GET", "/api/oauth/callback")(req, res);
      const redirectLocation: string = res.redirect.mock.calls[0][1];
      expect(redirectLocation).toContain("/#/oauth/callback?ticket=");
      expect(redirectLocation).not.toContain("productstockfinder:");
    } finally {
      vi.unstubAllGlobals();
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    }
  });
});
