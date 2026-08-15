import { describe, expect, it, vi, beforeEach } from "vitest";
import { createContext } from "../server/_core/context";
import { DEVICE_REVOKED_ERR_MSG } from "../shared/const";

vi.mock("../server/_core/sdk", () => ({
  sdk: { authenticateRequest: vi.fn() },
}));

vi.mock("../server/devices", () => ({
  isDeviceRevoked: vi.fn(),
}));

vi.mock("@/lib/_core/auth", () => ({
  removeSessionToken: vi.fn(async () => {}),
  clearUserInfo: vi.fn(async () => {}),
}));

vi.mock("@/lib/_core/api", () => ({
  logout: vi.fn(async () => {}),
}));

import { sdk } from "../server/_core/sdk";
import { isDeviceRevoked } from "../server/devices";

const mockedAuth = vi.mocked(sdk.authenticateRequest);
const mockedRevoked = vi.mocked(isDeviceRevoked);

function makeReq(headers: Record<string, string> = {}) {
  return {
    protocol: "https",
    hostname: "localhost",
    headers,
  } as any;
}

function makeRes() {
  return { clearCookie: () => {} } as any;
}

describe("createContext revocation check", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws DEVICE_REVOKED for a revoked device with a user", async () => {
    mockedAuth.mockResolvedValue({ id: 7 } as any);
    mockedRevoked.mockResolvedValue(true);
    await expect(
      createContext({
        req: makeReq({ "x-device-id": "dev-1" }),
        res: makeRes(),
      } as any),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: DEVICE_REVOKED_ERR_MSG,
    });
  });

  it("passes for a revoked device without a user", async () => {
    mockedAuth.mockRejectedValue(new Error("no user"));
    mockedRevoked.mockResolvedValue(true);
    const ctx = await createContext({
      req: makeReq({ "x-device-id": "dev-1" }),
      res: makeRes(),
    } as any);
    expect(ctx.user).toBeNull();
    expect(ctx.deviceId).toBe("dev-1");
  });

  it("passes for a non-revoked device with a user", async () => {
    mockedAuth.mockResolvedValue({ id: 7 } as any);
    mockedRevoked.mockResolvedValue(false);
    const ctx = await createContext({
      req: makeReq({ "x-device-id": "dev-1" }),
      res: makeRes(),
    } as any);
    expect(ctx.user?.id).toBe(7);
    expect(ctx.deviceId).toBe("dev-1");
  });

  it("passes when no device header is present", async () => {
    mockedAuth.mockResolvedValue({ id: 7 } as any);
    const ctx = await createContext({ req: makeReq(), res: makeRes() } as any);
    expect(ctx.deviceId).toBeNull();
    expect(mockedRevoked).not.toHaveBeenCalled();
  });

  it("throws DEVICE_REVOKED based on the token claim even when the header is absent", async () => {
    mockedAuth.mockResolvedValue({
      id: 7,
      sessionDeviceId: "dev-claim",
    } as any);
    mockedRevoked.mockResolvedValue(true);
    await expect(
      createContext({ req: makeReq(), res: makeRes() } as any),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: DEVICE_REVOKED_ERR_MSG,
    });
  });

  it("prefers the token claim over the header for ctx.deviceId", async () => {
    mockedAuth.mockResolvedValue({
      id: 7,
      sessionDeviceId: "dev-claim",
    } as any);
    mockedRevoked.mockResolvedValue(false);
    const ctx = await createContext({
      req: makeReq({ "x-device-id": "dev-header" }),
      res: makeRes(),
    } as any);
    expect(ctx.deviceId).toBe("dev-claim");
  });

  it("falls back to the header when the token has no deviceId claim", async () => {
    mockedAuth.mockResolvedValue({ id: 7, sessionDeviceId: null } as any);
    mockedRevoked.mockResolvedValue(true);
    await expect(
      createContext({
        req: makeReq({ "x-device-id": "dev-header" }),
        res: makeRes(),
      } as any),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: DEVICE_REVOKED_ERR_MSG,
    });
  });

  it("throws when the claim is revoked even if the header is clean", async () => {
    mockedAuth.mockResolvedValue({
      id: 7,
      sessionDeviceId: "dev-claim",
    } as any);
    mockedRevoked.mockResolvedValue(true);
    await expect(
      createContext({
        req: makeReq({ "x-device-id": "dev-header" }),
        res: makeRes(),
      } as any),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

import * as Auth from "@/lib/_core/auth";
import * as Api from "@/lib/_core/api";
import {
  handleDeviceRevoked,
  registerDeviceRevokedHandler,
  resetDeviceRevoked,
  resetDeviceRevokedForTests,
} from "@/lib/device-revoked";

const mockedRemove = vi.mocked(Auth.removeSessionToken);
const mockedClear = vi.mocked(Auth.clearUserInfo);
const mockedLogout = vi.mocked(Api.logout);

describe("lib/device-revoked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDeviceRevokedForTests();
  });

  it("clears the session and fires the registered handler once", async () => {
    const handler = vi.fn();
    registerDeviceRevokedHandler(handler);
    await handleDeviceRevoked();
    await handleDeviceRevoked();
    expect(mockedLogout).toHaveBeenCalledTimes(1);
    expect(mockedRemove).toHaveBeenCalledTimes(1);
    expect(mockedClear).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("clears the session even with no handler registered", async () => {
    await handleDeviceRevoked();
    expect(mockedLogout).toHaveBeenCalledTimes(1);
    expect(mockedRemove).toHaveBeenCalledTimes(1);
    expect(mockedClear).toHaveBeenCalledTimes(1);
  });

  it("still clears the local session when logout fails", async () => {
    mockedLogout.mockRejectedValueOnce(new Error("network"));
    await handleDeviceRevoked();
    expect(mockedLogout).toHaveBeenCalledTimes(1);
    expect(mockedRemove).toHaveBeenCalledTimes(1);
    expect(mockedClear).toHaveBeenCalledTimes(1);
  });

  it("can fire again after resetDeviceRevoked", async () => {
    const handler = vi.fn();
    registerDeviceRevokedHandler(handler);
    await handleDeviceRevoked();
    resetDeviceRevoked();
    await handleDeviceRevoked();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("fires the handler again after reset for tests", async () => {
    const handler = vi.fn();
    registerDeviceRevokedHandler(handler);
    await handleDeviceRevoked();
    resetDeviceRevokedForTests();
    registerDeviceRevokedHandler(handler);
    await handleDeviceRevoked();
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
