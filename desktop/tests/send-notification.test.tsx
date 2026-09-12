import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendDesktopNotification } from "../src/notifications";
import { invoke } from "@tauri-apps/api/core";

const mockStorage = vi.hoisted(() => ({
  getSettings: vi.fn(),
}));

vi.mock("../src/storage", () => ({
  storage: mockStorage,
}));

vi.mock("@tauri-apps/api/core", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("@tauri-apps/api/core")>();
  return {
    ...mod,
    invoke: vi.fn(),
  };
});

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getSettings.mockResolvedValue({
    webNotificationsEnabled: true,
  });
  Object.defineProperty(window, "isSecureContext", {
    writable: true,
    configurable: true,
    value: true,
  });
  Object.defineProperty(window, "Notification", {
    writable: true,
    configurable: true,
    value: Object.assign(vi.fn(), {
      permission: "granted",
      requestPermission: vi.fn().mockResolvedValue("granted"),
    }),
  });
});

describe("sendDesktopNotification", () => {
  it("logs the Tauri error before web fallback", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      vi.mocked(invoke).mockRejectedValue(new Error("denied"));
      await sendDesktopNotification("t", "b");
      expect(err).toHaveBeenCalledWith(
        expect.stringContaining("[notifications]"),
        expect.anything(),
      );
    } finally {
      err.mockRestore();
    }
  });
});
