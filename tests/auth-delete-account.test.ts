import { beforeEach, describe, expect, it, vi } from "vitest";

const clearAccountData = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@/constants/oauth", () => ({
  getApiBaseUrl: () => "http://api.test",
}));
vi.mock("@/lib/_core/api", () => ({}));
vi.mock("@/lib/_core/auth", () => ({
  getSessionToken: vi.fn(async () => "token"),
  getUserInfo: vi.fn(async () => ({ id: 7 })),
  removeSessionToken: vi.fn(async () => {}),
  clearUserInfo: vi.fn(async () => {}),
}));
vi.mock("@/lib/device-id", () => ({
  getDeviceId: vi.fn(async () => "dev-1"),
}));
const rememberExpiredAccount = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/expired-account", () => ({
  reconcileExpiredAccount: vi.fn(async () => {}),
  rememberExpiredAccount,
}));
vi.mock("@/lib/storage", () => ({ clearAccountData }));
vi.mock("@shared/log", () => ({
  log: { error: vi.fn(), debug: vi.fn() },
}));

import * as Auth from "@/lib/_core/auth";
import { deleteAccount } from "../hooks/auth-api";

describe("deleteAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true }),
      })),
    );
  });

  it("clears local account data after the server deletes the account", async () => {
    const setUser = vi.fn();
    await deleteAccount("DELETE", setUser);
    expect(rememberExpiredAccount).toHaveBeenCalledWith(7);
    expect(clearAccountData).toHaveBeenCalledTimes(1);
    expect(Auth.removeSessionToken).toHaveBeenCalledTimes(1);
    expect(Auth.clearUserInfo).toHaveBeenCalledTimes(1);
    expect(setUser).toHaveBeenCalledWith(null);
  });

  it("keeps local data when the server rejects the deletion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "nope" }),
      })),
    );
    await expect(deleteAccount("DELETE", vi.fn())).rejects.toThrow("nope");
    expect(clearAccountData).not.toHaveBeenCalled();
  });
});
