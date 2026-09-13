import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/price-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/price-cache")>();
  return { ...actual };
});

vi.mock("../server/push-notifications", () => ({
  upsertPushToken: vi.fn(),
  sendPushForDevice: vi.fn(),
  sendPushForUser: vi.fn(),
  clearPushTokensForTests: vi.fn(),
}));

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
}));

import {
  buildDigestDraft,
  mergeDigestHeld,
  shouldHoldScope,
} from "../server/notifications/digest";
import type { EventDraft } from "../server/notifications/types";
import {
  upsertDeviceConfig,
  evaluateNotifications,
  pullPendingEvents,
  clearNotificationsForTests,
  type NotificationConfig,
} from "../server/notifications";
import { setCachedPrice } from "../server/price-cache";
import { sendPushForDevice } from "../server/push-notifications";
import { getDb } from "../server/db";

const mockedGetDb = vi.mocked(getDb);

function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

function windowAround(now: number, beforeMin: number, afterMin: number) {
  return {
    start: hhmm(now - beforeMin * 60000),
    end: hhmm(now + afterMin * 60000),
  };
}

function draft(key: string, title = "Title"): EventDraft {
  return {
    id: `id-${key}`,
    type: "price_drop",
    dedupKey: key,
    title,
    body: `Body ${key}`,
    payload: { productId: "p1" },
    createdAt: Date.now(),
  };
}

const baseConfig: NotificationConfig = {
  alerts: [],
  stockWatches: [],
  dateReminders: [],
};

describe("shouldHoldScope", () => {
  it("holds when quiet hours cover now", () => {
    const now = Date.now();
    expect(
      shouldHoldScope(
        [{ ...baseConfig, quietHours: windowAround(now, 30, 30) }],
        now,
      ),
    ).toBe(true);
  });

  it("delivers without prefs", () => {
    expect(shouldHoldScope([baseConfig], Date.now())).toBe(false);
  });

  it("delivers outside the window", () => {
    const now = Date.now();
    expect(
      shouldHoldScope(
        [{ ...baseConfig, quietHours: windowAround(now - 3600000, 30, 30) }],
        now,
      ),
    ).toBe(false);
  });

  it("delivers when any device lacks prefs", () => {
    const now = Date.now();
    expect(
      shouldHoldScope(
        [baseConfig, { ...baseConfig, quietHours: windowAround(now, 30, 30) }],
        now,
      ),
    ).toBe(false);
  });
});

describe("mergeDigestHeld + buildDigestDraft", () => {
  it("merges by dedupKey, latest wins", () => {
    const buffer = new Map<string, EventDraft>();
    mergeDigestHeld(buffer, [draft("a", "Old")]);
    mergeDigestHeld(buffer, [draft("a", "New"), draft("b")]);
    expect(buffer.size).toBe(2);
    expect(buffer.get("a")?.title).toBe("New");
  });

  it("returns null for an empty buffer", () => {
    expect(buildDigestDraft([], "d:dev-1", Date.now())).toBeNull();
  });

  it("groups held items into one digest scoped to the day", () => {
    const now = Date.now();
    const digest = buildDigestDraft(
      [draft("a", "Drop A"), draft("b", "Drop B")],
      "d:dev-1",
      now,
    );
    expect(digest?.type).toBe("digest");
    expect(digest?.title).toContain("Digest");
    expect(digest?.body).toContain("Drop A");
    expect(digest?.body).toContain("Drop B");
    const nextDay = buildDigestDraft([draft("a")], "d:dev-1", now + 86400000);
    expect(nextDay?.dedupKey).not.toBe(digest?.dedupKey);
  });

  it("caps body lines with a +N more tail", () => {
    const held = Array.from({ length: 8 }, (_, i) => draft(`k${i}`, `T${i}`));
    const digest = buildDigestDraft(held, "d:dev-1", Date.now());
    expect(digest?.body).toContain("+3 more");
  });
});

describe("server digest hold-and-flush", () => {
  beforeEach(() => {
    clearNotificationsForTests();
    vi.clearAllMocks();
    mockedGetDb.mockResolvedValue(null);
  });

  async function seedDeviceWithQuietHours(now: number) {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: now,
    });
    await upsertDeviceConfig("dev-1", {
      ...baseConfig,
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
      quietHours: windowAround(now, 30, 30),
    });
  }

  it("holds events during quiet hours", async () => {
    const now = Date.now();
    await seedDeviceWithQuietHours(now);
    await evaluateNotifications(now);
    expect(await pullPendingEvents("dev-1")).toEqual([]);
    expect(sendPushForDevice).not.toHaveBeenCalled();
  });

  it("flushes one grouped digest after quiet hours end", async () => {
    const now = Date.now();
    await seedDeviceWithQuietHours(now);
    await evaluateNotifications(now);
    await evaluateNotifications(now + 3600000);
    const events = await pullPendingEvents("dev-1");
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("digest");
    expect(events[0]?.body).toContain("480");
    expect(sendPushForDevice).toHaveBeenCalledWith(
      "dev-1",
      expect.arrayContaining([expect.objectContaining({ type: "digest" })]),
    );
  });

  it("resumes individual delivery on later ticks", async () => {
    const now = Date.now();
    await seedDeviceWithQuietHours(now);
    await evaluateNotifications(now);
    await evaluateNotifications(now + 3600000);
    await pullPendingEvents("dev-1");
    await evaluateNotifications(now + 7200000);
    const events = await pullPendingEvents("dev-1");
    expect(events.map((e) => e.type)).toContain("price_drop");
  });
});
