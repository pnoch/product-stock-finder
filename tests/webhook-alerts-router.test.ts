import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const sendTestWebhook = vi.hoisted(() => vi.fn());
vi.mock("../server/notifications/webhook-alerts", () => ({ sendTestWebhook }));

function authedContext(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "open-7",
      name: null,
      email: null,
      loginMethod: null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    req: { protocol: "https", hostname: "localhost", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (_name: string, _options: Record<string, unknown>) => {},
    } as TrpcContext["res"],
    deviceId: "test-device",
  };
}

describe("notifications.testWebhook", () => {
  it("delegates to sendTestWebhook and returns its result", async () => {
    sendTestWebhook.mockResolvedValueOnce({ ok: true });
    const caller = appRouter.createCaller(authedContext());
    await expect(
      caller.notifications.testWebhook({ url: "https://discord.com/api/webhooks/1/x" }),
    ).resolves.toEqual({ ok: true });
    expect(sendTestWebhook).toHaveBeenCalledWith("https://discord.com/api/webhooks/1/x");
  });

  it("passes through a validation error", async () => {
    sendTestWebhook.mockResolvedValueOnce({ ok: false, error: "bad" });
    const caller = appRouter.createCaller(authedContext());
    await expect(
      caller.notifications.testWebhook({ url: "https://evil.com/x" }),
    ).resolves.toEqual({ ok: false, error: "bad" });
  });

  it("rejects an unauthenticated caller", async () => {
    const ctx = { ...authedContext(), user: null } as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.notifications.testWebhook({ url: "https://discord.com/api/webhooks/1/x" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
