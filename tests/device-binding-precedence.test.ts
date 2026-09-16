import { describe, expect, it, vi, beforeEach } from "vitest";

const configRows: Array<{ deviceId: string; userId: number | null }> = [];
const tokenRows: Array<{ deviceId: string; userId: number | null }> = [];

const dbStub = {
  select: () => ({
    from: (table: unknown) => ({
      where: async () => (table === devicePushTokens ? tokenRows : configRows),
    }),
  }),
};

vi.mock("../server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/db")>();
  return { ...actual, getDb: vi.fn(async () => dbStub) };
});

import { deviceNotificationConfigs, devicePushTokens } from "../drizzle/schema";
import { getDeviceBinding } from "../server/devices";

describe("getDeviceBinding precedence", () => {
  beforeEach(() => {
    configRows.length = 0;
    tokenRows.length = 0;
  });

  it("does not let an anonymous config mask a user-bound push token", async () => {
    configRows.push({ deviceId: "d1", userId: null });
    tokenRows.push({ deviceId: "d1", userId: 42 });
    const binding = await getDeviceBinding("d1");
    expect(binding.userId).toBe(42);
  });

  it("returns the config's user when present", async () => {
    configRows.push({ deviceId: "d1", userId: 7 });
    const binding = await getDeviceBinding("d1");
    expect(binding.userId).toBe(7);
  });

  it("returns null when neither row is user-bound", async () => {
    configRows.push({ deviceId: "d1", userId: null });
    const binding = await getDeviceBinding("d1");
    expect(binding.userId).toBeNull();
  });

  it("uses the real schema table names for the mock", () => {
    // Guards the mock's table discrimination above.
    expect(devicePushTokens).toBeDefined();
    expect(deviceNotificationConfigs).toBeDefined();
  });
});
