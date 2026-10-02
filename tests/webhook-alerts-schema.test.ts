import { describe, expect, it } from "vitest";

describe("notification_webhook_log schema", () => {
  it("exposes the table with the expected columns", async () => {
    const mod = await import("../drizzle/schema");
    expect(mod.notificationWebhookLog).toBeDefined();
    expect(mod.notificationWebhookLog.userId).toBeDefined();
    expect(mod.notificationWebhookLog.dedupKey).toBeDefined();
    expect(mod.notificationWebhookLog.sentAt).toBeDefined();
  });
});
