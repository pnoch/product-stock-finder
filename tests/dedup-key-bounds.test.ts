import { describe, expect, it } from "vitest";
import {
  dedupKeyFor,
  dedupKeyForHealth,
} from "../server/notifications/build-events";
import type { NotificationEvent } from "../server/notifications/types";

describe("dedup keys stay within the varchar(255) column", () => {
  it("clamps an over-long restock key", () => {
    const event = {
      type: "restock",
      productId: "p".repeat(191),
      distributorId: "d".repeat(64),
    } as NotificationEvent;
    const key = dedupKeyFor(event);
    expect(key.length).toBeLessThanOrEqual(255);
  });

  it("keeps distinct long keys distinct (stable hash suffix)", () => {
    const a = dedupKeyFor({
      type: "restock",
      productId: "p".repeat(191),
      distributorId: "a".repeat(64),
    } as NotificationEvent);
    const b = dedupKeyFor({
      type: "restock",
      productId: "p".repeat(191),
      distributorId: "b".repeat(64),
    } as NotificationEvent);
    expect(a).not.toBe(b);
  });

  it("leaves a short key untouched", () => {
    const key = dedupKeyFor({
      type: "price_drop",
      alertId: "a1",
    } as NotificationEvent);
    expect(key).toBe("price_drop:a1");
  });
});

describe("health dedup key uses server time, not the client timestamp", () => {
  it("is identical for different client createdAt values in the same hour", () => {
    const now = Date.parse("2026-06-15T12:00:00Z");
    const a = dedupKeyForHealth({ status: "blocked" }, "d1", now);
    const b = dedupKeyForHealth({ status: "blocked" }, "d1", now + 60_000);
    expect(a).toBe(b);
  });

  it("differs across hours", () => {
    const now = Date.parse("2026-06-15T12:00:00Z");
    const a = dedupKeyForHealth({ status: "blocked" }, "d1", now);
    const b = dedupKeyForHealth(
      { status: "blocked" },
      "d1",
      now + 2 * 60 * 60 * 1000,
    );
    expect(a).not.toBe(b);
  });

  it("differs by distributor and status", () => {
    const now = Date.parse("2026-06-15T12:00:00Z");
    expect(dedupKeyForHealth({ status: "blocked" }, "d1", now)).not.toBe(
      dedupKeyForHealth({ status: "blocked" }, "d2", now),
    );
    expect(dedupKeyForHealth({ status: "blocked" }, "d1", now)).not.toBe(
      dedupKeyForHealth({ status: "error" }, "d1", now),
    );
  });
});
