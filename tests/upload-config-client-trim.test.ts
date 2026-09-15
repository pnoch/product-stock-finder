import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/trpc", () => ({ createTRPCClient: vi.fn() }));
vi.mock("../lib/notifications", () => ({
  scheduleServerEventNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/storage", () => ({
  getPendingHealthEvents: vi.fn().mockResolvedValue([]),
  clearPendingHealthEvents: vi.fn(),
  getAlerts: vi.fn(),
  getStockWatches: vi.fn(),
  getBackOrderReminders: vi.fn(),
  getDisplayedEventIds: vi.fn().mockResolvedValue([]),
  recordDisplayedEventId: vi.fn().mockResolvedValue(undefined),
  recordNotificationEvent: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn(),
}));

import { syncServerNotifications } from "../lib/server-notifications";
import { createTRPCClient } from "../lib/trpc";
import * as storage from "../lib/storage";
import {
  MAX_UPLOAD_ALERTS,
  MAX_UPLOAD_DATE_REMINDERS,
  MAX_UPLOAD_STOCK_WATCHES,
} from "../shared/const";

function settings() {
  return {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "daily",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    healthAlerts: true,
    digestFrequency: "off",
  } as never;
}

describe("client trims upload config to the server caps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never sends more than the schema allows", async () => {
    vi.mocked(storage.getSettings).mockResolvedValue(settings());
    vi.mocked(storage.getAlerts).mockResolvedValue(
      Array.from({ length: 500 }, (_, i) => ({
        id: `a${i}`,
        productId: "p",
        targetPrice: 1,
        currency: "USD",
        isActive: true,
      })) as never,
    );
    vi.mocked(storage.getStockWatches).mockResolvedValue(
      Array.from({ length: 500 }, (_, i) => ({
        id: `w${i}`,
        productId: "p",
        distributorId: "d",
      })) as never,
    );
    vi.mocked(storage.getBackOrderReminders).mockResolvedValue(
      Array.from({ length: 500 }, (_, i) => ({
        id: `r${i}`,
        productId: "p",
        distributorId: "d",
        reminderType: "date",
        reminderDate: "2026-01-01",
      })) as never,
    );

    const mutate = vi.fn(async (_input: unknown) => ({ accepted: true }));
    vi.mocked(createTRPCClient).mockReturnValue({
      notifications: {
        uploadConfig: { mutate },
        pull: { query: vi.fn(async () => ({ events: [] })) },
      },
    } as never);

    await syncServerNotifications();

    expect(mutate).toHaveBeenCalledTimes(1);
    const payload = mutate.mock.calls[0]![0] as unknown as {
      alerts: unknown[];
      stockWatches: unknown[];
      dateReminders: unknown[];
    };
    expect(payload.alerts.length).toBeLessThanOrEqual(MAX_UPLOAD_ALERTS);
    expect(payload.stockWatches.length).toBeLessThanOrEqual(
      MAX_UPLOAD_STOCK_WATCHES,
    );
    expect(payload.dateReminders.length).toBeLessThanOrEqual(
      MAX_UPLOAD_DATE_REMINDERS,
    );
  });
});
