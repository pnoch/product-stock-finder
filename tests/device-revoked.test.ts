import { describe, expect, it, vi, beforeEach } from "vitest";
import { createContext } from "../server/_core/context";
import { DEVICE_REVOKED_ERR_MSG } from "../shared/const";
import { ForbiddenError } from "../shared/_core/errors";

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
    mockedAuth.mockRejectedValue(ForbiddenError("no user"));
    mockedRevoked.mockResolvedValue(true);
    const ctx = await createContext({
      req: makeReq({ "x-device-id": "dev-1" }),
      res: makeRes(),
    } as any);
    expect(ctx.user).toBeNull();
    expect(ctx.deviceId).toBeNull();
    expect(mockedRevoked).not.toHaveBeenCalled();
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

  it("checks the user's wildcard revocation when no device is present", async () => {
    mockedAuth.mockResolvedValue({ id: 7 } as any);
    mockedRevoked.mockResolvedValue(false);
    const ctx = await createContext({ req: makeReq(), res: makeRes() } as any);
    expect(ctx.deviceId).toBeNull();
    // A credential change writes a user-scoped "*" revocation, so a session
    // that never carried a device id cannot outlive it.
    expect(mockedRevoked).toHaveBeenCalledWith(7, "*");
    expect(ctx.user?.id).toBe(7);
  });

  it("rejects a device-less session revoked by a credential change", async () => {
    mockedAuth.mockResolvedValue({ id: 7 } as any);
    mockedRevoked.mockResolvedValue(true);
    await expect(
      createContext({ req: makeReq(), res: makeRes() } as any),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: DEVICE_REVOKED_ERR_MSG,
    });
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
    expect(mockedRevoked).toHaveBeenCalledWith(7, "dev-claim");
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
    expect(mockedRevoked).toHaveBeenCalledWith(7, "dev-claim");
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
    expect(mockedRevoked).toHaveBeenCalledWith(7, "dev-header");
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

  it("stops firing the handler after the returned deregister runs", async () => {
    const handler = vi.fn();
    const deregister = registerDeviceRevokedHandler(handler);
    deregister();
    await handleDeviceRevoked();
    // Local cleanup still happens, but the stale handler is not invoked.
    expect(mockedRemove).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });
});
