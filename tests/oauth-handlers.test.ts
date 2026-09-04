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
  upsertUser: vi.fn(async () => {}),
}));

import { registerOAuthRoutes } from "../server/_core/oauth";
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
    mockedRegister.mockRejectedValue(new Error("Email already registered"));

    const res = makeRes();
    await postHandler("POST", "/api/auth/register")(
      makeReq({ email: "test@example.com", password: "password123" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Email already registered" });
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
    mockedLogin.mockRejectedValue(new Error("Invalid email or password"));

    const res = makeRes();
    await postHandler("POST", "/api/auth/login")(
      makeReq({ email: "test@example.com", password: "wrong" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid email or password" });
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
