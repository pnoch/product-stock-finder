import { afterEach, describe, expect, it, vi } from "vitest";
import { checkNotificationPermission } from "../src/lib/notification-permission";

// The desktop alert/watch flows gate on this before creating a
// notification-backed record (parity with mobile's ensureNotificationPermission).
describe("checkNotificationPermission", () => {
  const original = (globalThis as { Notification?: unknown }).Notification;

  afterEach(() => {
    if (original === undefined) {
      delete (globalThis as { Notification?: unknown }).Notification;
    } else {
      (globalThis as { Notification?: unknown }).Notification = original;
    }
    vi.restoreAllMocks();
  });

  it("returns true when permission is already granted", async () => {
    (globalThis as { Notification?: unknown }).Notification = {
      permission: "granted",
    };
    expect(await checkNotificationPermission()).toBe(true);
  });

  it("returns false when permission is denied", async () => {
    (globalThis as { Notification?: unknown }).Notification = {
      permission: "denied",
    };
    expect(await checkNotificationPermission()).toBe(false);
  });

  it("requests permission when undecided and returns the result", async () => {
    const requestPermission = vi.fn(async () => "granted");
    (globalThis as { Notification?: unknown }).Notification = {
      permission: "default",
      requestPermission,
    };
    expect(await checkNotificationPermission()).toBe(true);
    expect(requestPermission).toHaveBeenCalled();
  });

  it("returns false when the request is declined", async () => {
    (globalThis as { Notification?: unknown }).Notification = {
      permission: "default",
      requestPermission: vi.fn(async () => "denied"),
    };
    expect(await checkNotificationPermission()).toBe(false);
  });

  it("falls through to true for Tauri (no Notification API)", async () => {
    delete (globalThis as { Notification?: unknown }).Notification;
    expect(await checkNotificationPermission()).toBe(true);
  });
});
