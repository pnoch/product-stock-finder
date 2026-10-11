import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("push diagnostics wiring", () => {
  it("diagnostics route exists", () => {
    expect(read("app/diagnostics.tsx")).toContain("Push Diagnostics");
  });

  it("settings links to diagnostics", () => {
    expect(
      read("components/settings/notifications-section.tsx"),
    ).toContain("/diagnostics");
  });

  it("router exposes pushStatusAll and sendTestPush", () => {
    const src = read("server/routers/notifications.ts");
    expect(src).toContain("pushStatusAll");
    expect(src).toContain("sendTestPush");
  });

  it("schema has pushDeliveryLog table", () => {
    expect(read("drizzle/schema.ts")).toContain("push_delivery_log");
  });

  it("client wrappers exist", () => {
    const src = read("lib/server-notifications.ts");
    expect(src).toContain("fetchPushStatusAll");
    expect(src).toContain("pushErrorHelpText");
  });
});
