import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { clearRateLimitsForTests } from "../server/rate-limit";

vi.mock("../server/db", () => ({ getDb: vi.fn(async () => null) }));
vi.mock("../server/devices", () => ({
  assertDeviceAccess: vi.fn(async () => {}),
}));
vi.mock("../server/product-parse", () => ({
  parseProductText: vi.fn(async () => ({
    name: "Widget",
    modelNumber: "W1",
    brand: "B",
    category: "C",
    description: "",
  })),
}));
vi.mock("../server/fx", () => ({
  getFxRates: vi.fn(async () => ({ USD: 1, EUR: 0.9 })),
}));

function ctx(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
      ip: "10.0.0.1",
      socket: { remoteAddress: "10.0.0.1" },
    } as unknown as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    deviceId: null,
    ...overrides,
  };
}

function authedCtx(userId = 1, deviceId: string | null = "dev-1"): TrpcContext {
  return ctx({
    user: {
      id: userId,
      openId: `open-${userId}`,
      name: "Name",
      email: "n@x.com",
      loginMethod: "email",
      role: "user",
      emailVerified: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date("2026-01-02T03:04:05.000Z"),
    } as TrpcContext["user"],
    deviceId,
  });
}

beforeEach(() => {
  clearRateLimitsForTests();
});

describe("auth.me", () => {
  it("returns null for a signed-out caller", async () => {
    expect(await appRouter.createCaller(ctx()).auth.me()).toBeNull();
  });

  it("maps the authenticated user without leaking secrets", async () => {
    const me = await appRouter.createCaller(authedCtx(7)).auth.me();
    expect(me).toEqual({
      id: 7,
      openId: "open-7",
      name: "Name",
      email: "n@x.com",
      loginMethod: "email",
      lastSignedIn: "2026-01-02T03:04:05.000Z",
      emailVerified: true,
    });
    expect(me).not.toHaveProperty("passwordHash");
    expect(me).not.toHaveProperty("role");
  });

  it("reports a missing lastSignedIn as null", async () => {
    const caller = appRouter.createCaller(
      ctx({
        user: {
          id: 8,
          openId: "open-8",
          lastSignedIn: null,
        } as unknown as TrpcContext["user"],
      }),
    );
    expect((await caller.auth.me())?.lastSignedIn).toBeNull();
  });
});

describe("device-scoped router guards", () => {
  it("rejects notifications.uploadConfig without a device id", async () => {
    const caller = appRouter.createCaller(authedCtx(1, null));
    await expect(
      caller.notifications.uploadConfig({
        alerts: [],
        stockWatches: [],
        dateReminders: [],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Missing device id" });
  });

  it("rejects notifications.pull without a device id", async () => {
    const caller = appRouter.createCaller(authedCtx(1, null));
    await expect(caller.notifications.pull({})).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Missing device id",
    });
  });

  it("rejects registerPushToken without a device id", async () => {
    const caller = appRouter.createCaller(authedCtx(1, null));
    await expect(
      caller.notifications.registerPushToken({ token: "t", platform: "ios" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Missing device id",
    });
  });

  it("rejects a malformed web push subscription", async () => {
    const caller = appRouter.createCaller(authedCtx());
    await expect(
      caller.notifications.registerPushToken({
        token: "not-json",
        platform: "web",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Invalid web push subscription",
    });
  });

  it("rejects a web push subscription to a non-push endpoint", async () => {
    const caller = appRouter.createCaller(authedCtx());
    await expect(
      caller.notifications.registerPushToken({
        token: JSON.stringify({ endpoint: "http://169.254.169.254/latest/" }),
        platform: "web",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Unsupported push endpoint",
    });
  });
});

describe("public data routers", () => {
  it("serves FX rates", async () => {
    const res = await appRouter.createCaller(ctx()).fx.get();
    expect(res).toEqual({ USD: 1, EUR: 0.9 });
  });

  it("parses a product from raw text", async () => {
    const res = await appRouter
      .createCaller(ctx())
      .products.parse({ raw: "MikroTik CRS804" });
    expect(res.product).toMatchObject({ name: "Widget", modelNumber: "W1" });
  });
});
