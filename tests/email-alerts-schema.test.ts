import { describe, expect, it } from "vitest";

describe("notification_email_log schema", () => {
  it("exposes the table with the expected columns", async () => {
    const mod = await import("../drizzle/schema");
    expect(mod.notificationEmailLog).toBeDefined();
    expect(mod.notificationEmailLog.userId).toBeDefined();
    expect(mod.notificationEmailLog.dedupKey).toBeDefined();
    expect(mod.notificationEmailLog.sentAt).toBeDefined();
  });
});
