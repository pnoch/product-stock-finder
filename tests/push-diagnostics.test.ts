import { describe, expect, it, beforeEach } from "vitest";
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
