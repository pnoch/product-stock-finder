import { describe, expect, it, vi, beforeEach } from "vitest";
import { devicePushTokens } from "../drizzle/schema";

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
}));

import { getDb } from "../server/db";

const mockedGetDb = vi.mocked(getDb);

const dbStub = {
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      onDuplicateKeyUpdate: vi.fn(async () => undefined),
    })),
  })),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(async () => [{ token: "ExponentPushToken[dbpath]" }]),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(async () => undefined),
  })),
};

const sent = vi.hoisted(() => [] as unknown[]);

const pushState = vi.hoisted(() => ({
  tickets: [{ status: "ok" }] as Array<{
    status: string;
    details?: { error?: string };
  }>,
}));

vi.mock("expo-server-sdk", () => ({
  Expo: class {
    static isExpoPushToken = (value: unknown) =>
      typeof value === "string" && value.startsWith("ExponentPushToken");
    chunkPushNotifications(messages: unknown[]) {
      return [messages];
    }
    async sendPushNotificationsAsync(chunk: unknown) {
      sent.push(chunk);
      return pushState.tickets;
    }
  },
}));

import {
  upsertPushToken,
  sendPushForDevice,
  pruneDeviceToken,
  clearPushTokensForTests,
} from "../server/push-notifications";

const event = { id: "evt-1", title: "💸 Price Drop Alert!", body: "CRS804 is now $480.00!" };

describe("push-notifications", () => {
  beforeEach(() => {
    clearPushTokensForTests();
    sent.length = 0;
    pushState.tickets = [{ status: "ok" }];
    vi.clearAllMocks();
    mockedGetDb.mockResolvedValue(dbStub as never);
  });

  it("pushes events for a device that registered a token", async () => {
    mockedGetDb.mockResolvedValue(null);
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios");
    await sendPushForDevice("dev-1", [event]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual([
      {
        to: "ExponentPushToken[abc123]",
        title: "💸 Price Drop Alert!",
        body: "CRS804 is now $480.00!",
        data: { eventId: "evt-1" },
      },
    ]);
  });

  it("no-ops when the device has no registered token", async () => {
    mockedGetDb.mockResolvedValue(null);
    await sendPushForDevice("dev-1", [event]);
    expect(sent).toHaveLength(0);
  });

  it("no-ops when the stored token is not a valid Expo push token", async () => {
    mockedGetDb.mockResolvedValue(null);
    await upsertPushToken("dev-1", "not-an-expo-token", "android");
    await sendPushForDevice("dev-1", [event]);
    expect(sent).toHaveLength(0);
  });

  it("no-ops when there are no events", async () => {
    mockedGetDb.mockResolvedValue(null);
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios");
    await sendPushForDevice("dev-1", []);
    expect(sent).toHaveLength(0);
  });

  it("upserts the push token through the database", async () => {
    await upsertPushToken("dev-1", "ExponentPushToken[dbpath]", "ios");
    expect(dbStub.insert).toHaveBeenCalledWith(devicePushTokens);
    const insertMock = dbStub.insert;
    const valuesMock = insertMock.mock.results[0].value.values;
    expect(valuesMock.mock.calls[0][0]).toMatchObject({
      deviceId: "dev-1",
      token: "ExponentPushToken[dbpath]",
      platform: "ios",
      updatedAt: expect.any(Number),
    });
  });

  it("sends push using the token from the database", async () => {
    await sendPushForDevice("dev-1", [event]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual([
      {
        to: "ExponentPushToken[dbpath]",
        title: "💸 Price Drop Alert!",
        body: "CRS804 is now $480.00!",
        data: { eventId: "evt-1" },
      },
    ]);
  });

  it("does not throw when the database token read fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockedGetDb.mockResolvedValue({
      select: vi.fn(() => {
        throw new Error("db down");
      }),
    } as never);
    await expect(sendPushForDevice("dev-1", [event])).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("pruneDeviceToken removes the token from the memory store", async () => {
    mockedGetDb.mockResolvedValue(null);
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios");
    await pruneDeviceToken("dev-1");
    await sendPushForDevice("dev-1", [event]);
    expect(sent).toHaveLength(0);
  });

  it("pruneDeviceToken deletes the row through the database", async () => {
    await pruneDeviceToken("dev-1");
    expect(dbStub.delete).toHaveBeenCalledWith(devicePushTokens);
  });

  it("pruneDeviceToken never throws when the database delete fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockedGetDb.mockResolvedValue({
      delete: vi.fn(() => {
        throw new Error("db down");
      }),
    } as never);
    await expect(pruneDeviceToken("dev-1")).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
