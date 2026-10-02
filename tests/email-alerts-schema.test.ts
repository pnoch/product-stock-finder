import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("notification_email_log schema", () => {
  it("has the expected table and column names", async () => {
    const mod = await import("../drizzle/schema");
    const t = mod.notificationEmailLog;
    expect(getTableName(t)).toBe("notification_email_log");
    expect(t.userId.name).toBe("userId");
    expect(t.dedupKey.name).toBe("dedupKey");
    expect(t.sentAt.name).toBe("sentAt");
    expect(t.userId.notNull).toBe(true);
    expect(t.dedupKey.notNull).toBe(true);
    expect(t.sentAt.notNull).toBe(true);
  });
});
