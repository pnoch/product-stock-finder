import { describe, expect, it } from "vitest";
import { unsubscribeToken, verifyUnsubscribeToken } from "../server/notifications/email-alerts";

describe("unsubscribe token", () => {
  it("round-trips for the same user", () => {
    const t = unsubscribeToken(42);
    expect(verifyUnsubscribeToken(42, t)).toBe(true);
  });

  it("rejects another user's token", () => {
    expect(verifyUnsubscribeToken(43, unsubscribeToken(42))).toBe(false);
  });

  it("rejects a tampered or wrong-length token", () => {
    const t = unsubscribeToken(42);
    expect(verifyUnsubscribeToken(42, t.slice(0, -1) + (t.endsWith("a") ? "b" : "a"))).toBe(false);
    expect(verifyUnsubscribeToken(42, "short")).toBe(false);
  });
});
