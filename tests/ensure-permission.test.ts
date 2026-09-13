import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-notifications", () => ({
  getPermissionsAsync: vi.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync: vi.fn(async () => ({ status: "granted" })),
  setNotificationHandler: vi.fn(),
  AndroidImportance: { HIGH: "high", DEFAULT: "default" },
}));

import { Platform } from "react-native";
import { ensureNotificationPermission } from "../lib/notifications";

describe("ensureNotificationPermission", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("uses the native permission flow off web", async () => {
    (Platform as { OS: string }).OS = "ios";
    await expect(ensureNotificationPermission()).resolves.toBe(true);
  });

  it("uses the web permission flow on web", async () => {
    (Platform as { OS: string }).OS = "web";
    vi.doMock("../lib/web-notifications", () => ({
      requestWebNotificationPermission: vi.fn(async () => "granted"),
    }));
    const fresh = await import("../lib/notifications");
    await expect(fresh.ensureNotificationPermission()).resolves.toBe(true);
    (Platform as { OS: string }).OS = "ios";
  });
});
