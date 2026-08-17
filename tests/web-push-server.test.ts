import { describe, expect, it, vi, beforeEach } from "vitest";

const sent = vi.hoisted(
  () =>
    [] as Array<{ subscription: unknown; payload: string }>,
);
const sendError = vi.hoisted(() => ({ statusCode: 0 }));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async (subscription: unknown, payload: string) => {
      if (sendError.statusCode) {
        const err = new Error("push failed") as Error & { statusCode: number };
        err.statusCode = sendError.statusCode;
        throw err;
      }
      sent.push({ subscription, payload });
    }),
  },
}));

vi.mock("../server/push-notifications", () => ({
  pruneDeviceToken: vi.fn(async () => {}),
}));

import { sendWebPush } from "../server/web-push";
import { pruneDeviceToken } from "../server/push-notifications";

const subscription = {
  endpoint: "https://push.example.com/abc",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
};
const event = {
  id: "evt-1",
  title: "💸 Price Drop Alert!",
  body: "CRS804 is now $480.00!",
};

describe("web-push server", () => {
  beforeEach(() => {
    sent.length = 0;
    sendError.statusCode = 0;
    delete process.env.VAPID_SUBJECT;
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    vi.clearAllMocks();
  });

  it("no-ops when VAPID env vars are missing", async () => {
    await sendWebPush("dev-1", subscription, event);
    expect(sent).toHaveLength(0);
  });

  it("sends a VAPID-signed notification with the event payload", async () => {
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    await sendWebPush("dev-1", subscription, event);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subscription).toEqual(subscription);
    expect(JSON.parse(sent[0]!.payload)).toEqual({
      title: event.title,
      body: event.body,
      eventId: "evt-1",
    });
  });

  it("prunes the device token on 404 (subscription gone)", async () => {
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    sendError.statusCode = 404;
    await sendWebPush("dev-1", subscription, event);
    expect(pruneDeviceToken).toHaveBeenCalledWith("dev-1");
  });

  it("prunes the device token on 410 (subscription gone)", async () => {
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    sendError.statusCode = 410;
    await sendWebPush("dev-1", subscription, event);
    expect(pruneDeviceToken).toHaveBeenCalledWith("dev-1");
  });

  it("warns without crashing on other errors", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    sendError.statusCode = 500;
    await expect(
      sendWebPush("dev-1", subscription, event),
    ).resolves.toBeUndefined();
    expect(pruneDeviceToken).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});