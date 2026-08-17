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

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: { eventId: string };
};

const sent = vi.hoisted(() => [] as PushMessage[][]);

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
      sent.push(chunk as PushMessage[]);
      return pushState.tickets;
    }
  },
}));

vi.mock("../server/web-push", () => ({
  sendWebPush: vi.fn(async () => {}),
}));

import {
  upsertPushToken,
  sendPushForDevice,
  sendPushForUser,
  pruneDeviceToken,
  clearPushTokensForTests,
} from "../server/push-notifications";
import { sendWebPush } from "../server/web-push";

const event = {
  id: "evt-1",
  title: "💸 Price Drop Alert!",
  body: "CRS804 is now $480.00!",
};

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

  it("routes web subscriptions through sendWebPush", async () => {
    mockedGetDb.mockResolvedValue(null);
    const subscription = {
      endpoint: "https://push.example.com/abc",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    };
    await upsertPushToken("dev-1", JSON.stringify(subscription), "web");
    await sendPushForDevice("dev-1", [event]);
    expect(sendWebPush).toHaveBeenCalledWith("dev-1", subscription, event);
    expect(sent).toHaveLength(0);
  });

  it("does not send Expo push for web subscriptions", async () => {
    mockedGetDb.mockResolvedValue(null);
    await upsertPushToken(
      "dev-1",
      JSON.stringify({
        endpoint: "https://push.example.com/abc",
        keys: { p256dh: "p256dh-key", auth: "auth-key" },
      }),
      "web",
    );
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

  it("omits userId from the duplicate-key update set on anonymous upsert", async () => {
    const onUpdateSets: Array<Record<string, unknown>> = [];
    const dbStub = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onDuplicateKeyUpdate: vi.fn(
            (arg: { set: Record<string, unknown> }) => {
              onUpdateSets.push(arg.set);
              return Promise.resolve(undefined);
            },
          ),
        })),
      })),
    };
    mockedGetDb.mockResolvedValue(dbStub as never);

    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios", 7);
    expect(onUpdateSets).toHaveLength(1);
    expect(onUpdateSets[0]!.userId).toBe(7);

    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios");
    expect(onUpdateSets).toHaveLength(2);
    expect(onUpdateSets[1]).not.toHaveProperty("userId");

    mockedGetDb.mockResolvedValue(null);
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

  it("deletes the token row when a send ticket reports DeviceNotRegistered", async () => {
    pushState.tickets = [
      { status: "error", details: { error: "DeviceNotRegistered" } },
    ];
    await sendPushForDevice("dev-1", [event]);
    expect(dbStub.delete).toHaveBeenCalledWith(devicePushTokens);
  });

  it("does not delete when all send tickets are ok", async () => {
    pushState.tickets = [{ status: "ok" }];
    await sendPushForDevice("dev-1", [event]);
    expect(dbStub.delete).not.toHaveBeenCalled();
  });

  it("does not delete on other error codes", async () => {
    pushState.tickets = [
      { status: "error", details: { error: "MessageTooBig" } },
    ];
    await sendPushForDevice("dev-1", [event]);
    expect(dbStub.delete).not.toHaveBeenCalled();
  });

  it("prunes the memory token when a send ticket reports DeviceNotRegistered", async () => {
    mockedGetDb.mockResolvedValue(null);
    await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios");
    pushState.tickets = [
      { status: "error", details: { error: "DeviceNotRegistered" } },
    ];
    await sendPushForDevice("dev-1", [event]);
    expect(sent).toHaveLength(1);
    pushState.tickets = [{ status: "ok" }];
    await sendPushForDevice("dev-1", [event]);
    expect(sent).toHaveLength(1);
  });

  describe("sendPushForUser", () => {
    beforeEach(() => {
      clearPushTokensForTests();
      sent.length = 0;
      pushState.tickets = [{ status: "ok" }];
      vi.clearAllMocks();
      mockedGetDb.mockResolvedValue(null);
    });

    it("sends a user event to every device bound to the user", async () => {
      await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios", 7);
      await upsertPushToken("dev-2", "ExponentPushToken[def456]", "android", 7);
      await sendPushForUser(7, [event]);
      expect(sent).toHaveLength(2);
      expect(sent[0]![0]!.to).toBe("ExponentPushToken[abc123]");
      expect(sent[1]![0]!.to).toBe("ExponentPushToken[def456]");
    });

    it("skips devices bound to other users", async () => {
      await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios", 7);
      await upsertPushToken("dev-2", "ExponentPushToken[def456]", "android", 8);
      await sendPushForUser(7, [event]);
      expect(sent).toHaveLength(1);
      expect(sent[0]![0]!.to).toBe("ExponentPushToken[abc123]");
    });

    it("no-ops when the user has no bound devices", async () => {
      await sendPushForUser(7, [event]);
      expect(sent).toHaveLength(0);
    });

    it("keeps the user binding when a bound device re-registers anonymously", async () => {
      await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios", 7);
      await upsertPushToken("dev-1", "ExponentPushToken[abc123]", "ios");
      await sendPushForUser(7, [event]);
      expect(sent).toHaveLength(1);
    });

    it("sends using device tokens read from the database", async () => {
      mockedGetDb.mockResolvedValue({
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onDuplicateKeyUpdate: vi.fn(async () => undefined),
          })),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => [
              { deviceId: "dev-1", token: "ExponentPushToken[dbpath]" },
            ]),
          })),
        })),
      } as never);
      await upsertPushToken("dev-1", "ExponentPushToken[dbpath]", "ios", 7);
      await sendPushForUser(7, [event]);
      expect(sent).toHaveLength(1);
      expect(sent[0]![0]!.to).toBe("ExponentPushToken[dbpath]");
    });
  });
});
