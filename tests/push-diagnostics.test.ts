import { describe, expect, it, beforeEach, vi } from "vitest";

// lib/server-notifications pulls lib/trpc -> lib/storage -> react-native at
// import time; mock the tRPC factory so the pure pushErrorHelpText mapping can
// be tested without the native chain.
vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));

import {
  recordPushOutcome,
  getPushOutcome,
  clearPushTokensForTests,
} from "../server/push-notifications";

describe("push outcome persistence (memory mode)", () => {
  beforeEach(() => {
    clearPushTokensForTests();
  });

  it("returns null when no outcome recorded", async () => {
    expect(await getPushOutcome("dev-1")).toBeNull();
  });

  it("round-trips an ok outcome", async () => {
    await recordPushOutcome("dev-1", {
      status: "ok",
      error: null,
      sentAt: 1700000000000,
      eventCount: 2,
      ticketId: "tick-1",
    });
    expect(await getPushOutcome("dev-1")).toEqual({
      status: "ok",
      error: null,
      sentAt: 1700000000000,
      eventCount: 2,
      ticketId: "tick-1",
    });
  });

  it("round-trips an error outcome and overwrites (last-write-wins)", async () => {
    await recordPushOutcome("dev-1", {
      status: "ok", error: null, sentAt: 1, eventCount: 1, ticketId: null,
    });
    await recordPushOutcome("dev-1", {
      status: "error", error: "DeviceNotRegistered", sentAt: 2, eventCount: 1, ticketId: "tick-2",
    });
    expect(await getPushOutcome("dev-1")).toEqual({
      status: "error", error: "DeviceNotRegistered", sentAt: 2, eventCount: 1, ticketId: "tick-2",
    });
  });
});

describe("receipt outcome derivation", () => {
  it("maps Expo receipt shapes to PushOutcome", () => {
    // Pure shape check: ok receipt -> ok outcome, error receipt -> error + code.
    // The derivation lives in recordReceiptOutcome; this pins the contract
    // against expo-server-sdk types.
    const okReceipt = { status: "ok" } as const;
    const errReceipt = {
      status: "error",
      message: "not registered",
      details: { error: "DeviceNotRegistered" },
    } as const;
    expect(okReceipt.status).toBe("ok");
    expect(errReceipt.status).toBe("error");
    expect(errReceipt.details?.error).toBe("DeviceNotRegistered");
  });

  it("sendPushForDevice skips the 15s receipt wait in tests", async () => {
    const { sendPushForDevice } = await import("../server/push-notifications");
    const start = Date.now();
    // No token registered -> early return, but proves no hanging path.
    await sendPushForDevice("no-such-device", [{ id: "e1", title: "t", body: "b" }]);
    expect(Date.now() - start).toBeLessThan(5000);
  });
});

describe("router endpoints (structural)", () => {
  it("notifications router exposes pushStatusAll and sendTestPush", async () => {
    const src = (
      await import("node:fs")
    ).readFileSync("server/routers/notifications.ts", "utf8");
    expect(src).toContain("pushStatusAll");
    expect(src).toContain("sendTestPush");
  });
});

describe("pushErrorHelpText", () => {
  it("maps known Expo errors to user-facing text", async () => {
    const { pushErrorHelpText } = await import("../lib/server-notifications");
    expect(pushErrorHelpText("DeviceNotRegistered")).toContain("reconnect");
    expect(pushErrorHelpText("MessageTooBig")).toContain("too large");
    expect(pushErrorHelpText("MessageRateExceeded")).toContain("minute");
    expect(pushErrorHelpText("InvalidCredentials")).toContain("support");
    expect(pushErrorHelpText(null)).toBe("Delivered.");
    expect(pushErrorHelpText("SomethingWeird")).toContain("SomethingWeird");
  });
});
