import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Auth from "@/lib/_core/auth";
import {
  handleSessionExpired,
  registerSessionExpiredHandler,
  resetSessionExpiredForTests,
} from "@/lib/session-expired";

vi.mock("@/lib/_core/auth", () => ({
  getSessionToken: vi.fn(async () => "token"),
  getUserInfo: vi.fn(async () => ({ id: 1 })),
  removeSessionToken: vi.fn(async () => {}),
  clearUserInfo: vi.fn(async () => {}),
}));

const rememberExpiredAccount = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/expired-account", () => ({ rememberExpiredAccount }));

const mockedRemove = vi.mocked(Auth.removeSessionToken);
const mockedClear = vi.mocked(Auth.clearUserInfo);
const mockedToken = vi.mocked(Auth.getSessionToken);
const mockedUser = vi.mocked(Auth.getUserInfo);

describe("lib/session-expired", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedToken.mockResolvedValue("token");
    mockedUser.mockResolvedValue({ id: 1 } as never);
    resetSessionExpiredForTests();
  });

  it("does nothing when the user is already signed out", async () => {
    mockedToken.mockResolvedValue(null);
    mockedUser.mockResolvedValue(null);
    const handler = vi.fn();
    registerSessionExpiredHandler(handler);
    await handleSessionExpired();
    expect(mockedRemove).not.toHaveBeenCalled();
    expect(mockedClear).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("clears the session and fires the registered handler once", async () => {
    const handler = vi.fn();
    registerSessionExpiredHandler(handler);
    await handleSessionExpired();
    await handleSessionExpired();
    expect(mockedRemove).toHaveBeenCalledTimes(1);
    expect(mockedClear).toHaveBeenCalledTimes(1);
    expect(rememberExpiredAccount).toHaveBeenCalledWith(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("clears the session even with no handler registered", async () => {
    await handleSessionExpired();
    expect(mockedRemove).toHaveBeenCalledTimes(1);
    expect(mockedClear).toHaveBeenCalledTimes(1);
  });

  it("does not fire again when the handler is re-registered mid-cycle", async () => {
    const first = vi.fn();
    const second = vi.fn();
    registerSessionExpiredHandler(first);
    await handleSessionExpired();
    registerSessionExpiredHandler(second);
    await handleSessionExpired();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("stops firing the handler after the returned deregister runs", async () => {
    const handler = vi.fn();
    const deregister = registerSessionExpiredHandler(handler);
    deregister();
    await handleSessionExpired();
    expect(mockedRemove).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });

  it("can fire again after the reset helper", async () => {
    const handler = vi.fn();
    registerSessionExpiredHandler(handler);
    await handleSessionExpired();
    resetSessionExpiredForTests();
    registerSessionExpiredHandler(handler);
    await handleSessionExpired();
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
