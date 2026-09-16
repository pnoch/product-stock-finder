import { describe, expect, it } from "vitest";
import { createStorage } from "../lib/storage";
import type { BackOrderReminder } from "../lib/types";

function makeStorage() {
  const m = new Map<string, string>();
  return createStorage({
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: async (k: string) => {
      m.delete(k);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => m.delete(k));
    },
  });
}

function reminder(id: string): BackOrderReminder {
  return {
    id,
    productId: "p1",
    productName: "CRS804",
    distributorId: "d1",
    distributorName: "D1",
    reminderDate: "2026-06-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    reminderType: "date",
  };
}

describe("date reminder dedup", () => {
  it("replaces an existing reminder for the same product+distributor", async () => {
    const storage = makeStorage();
    await storage.addBackOrderReminder(reminder("r1"));
    // A second tap mints a new id; it must replace, not accumulate.
    await storage.addBackOrderReminder(reminder("r2"));
    const all = await storage.getBackOrderReminders();
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe("r2");
  });

  it("keeps reminders for different distributors", async () => {
    const storage = makeStorage();
    await storage.addBackOrderReminder(reminder("r1"));
    await storage.addBackOrderReminder({
      ...reminder("r2"),
      distributorId: "d2",
    });
    expect(await storage.getBackOrderReminders()).toHaveLength(2);
  });
});
