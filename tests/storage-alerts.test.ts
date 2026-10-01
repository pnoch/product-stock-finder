import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStorage, type Storage } from "../lib/storage";
import type { PriceAlert } from "../lib/types";

function makeStorage(): { storage: Storage; notify: ReturnType<typeof vi.fn> } {
  const store = new Map<string, string>();
  const storage = createStorage({
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: async (k: string) => {
      store.delete(k);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => store.delete(k));
    },
  });
  const notify = vi.fn();
  storage.subscribeToStorageChanges(notify);
  return { storage, notify };
}

function alert(id: string, overrides: Partial<PriceAlert> = {}): PriceAlert {
  return {
    id,
    productId: "p1",
    targetPrice: 500,
    currency: "USD",
    isActive: true,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function byId(alerts: PriceAlert[], id: string): PriceAlert | undefined {
  return alerts.find((a) => a.id === id);
}

describe("alert CRUD", () => {
  it("unshifts new alerts (newest first) and notifies", async () => {
    const { storage, notify } = makeStorage();
    await storage.addAlert(alert("a1"));
    await storage.addAlert(alert("a2"));
    const alerts = await storage.getAlerts();
    expect(alerts.map((a) => a.id)).toEqual(["a2", "a1"]);
    expect(notify).toHaveBeenCalledWith("alerts", "a2");
  });

  it("removes an alert and notifies", async () => {
    const { storage, notify } = makeStorage();
    await storage.addAlert(alert("a1"));
    await storage.addAlert(alert("a2"));
    await storage.removeAlert("a1");
    expect((await storage.getAlerts()).map((a) => a.id)).toEqual(["a2"]);
    expect(notify).toHaveBeenCalledWith("alerts", "a1");
  });

  it("toggles an alert's active flag", async () => {
    const { storage } = makeStorage();
    await storage.addAlert(alert("a1"));
    await storage.toggleAlert("a1");
    expect(byId(await storage.getAlerts(), "a1")!.isActive).toBe(false);
    await storage.toggleAlert("a1");
    expect(byId(await storage.getAlerts(), "a1")!.isActive).toBe(true);
  });
});

describe("snoozeAlert", () => {
  it("sets snoozedUntil ~N days ahead for a positive duration", async () => {
    const { storage } = makeStorage();
    await storage.addAlert(alert("a1"));
    const before = Date.now();
    await storage.snoozeAlert("a1", 3);
    const until = Date.parse(byId(await storage.getAlerts(), "a1")!.snoozedUntil!);
    expect(until).toBeGreaterThanOrEqual(before + 3 * 86_400_000);
    expect(until).toBeLessThanOrEqual(Date.now() + 3 * 86_400_000);
  });

  it("clears the snooze for a non-positive duration", async () => {
    const { storage } = makeStorage();
    await storage.addAlert(alert("a1", { snoozedUntil: "2030-01-01T00:00:00.000Z" }));
    await storage.snoozeAlert("a1", 0);
    expect(byId(await storage.getAlerts(), "a1")!.snoozedUntil).toBeUndefined();
  });
});

describe("updateAlert", () => {
  it("applies each provided field and re-arms the alert", async () => {
    const { storage } = makeStorage();
    await storage.addAlert(
      alert("a1", {
        isActive: false,
        triggeredAt: "2026-08-02T00:00:00.000Z",
        triggeredPrice: 480,
        snoozedUntil: "2026-08-05T00:00:00.000Z",
      }),
    );
    await storage.updateAlert("a1", {
      targetPrice: 450,
      currency: "EUR",
      direction: "rise",
      distributorId: "server2u",
    });
    const updated = byId(await storage.getAlerts(), "a1")!;
    expect(updated).toMatchObject({
      targetPrice: 450,
      currency: "EUR",
      direction: "rise",
      distributorId: "server2u",
      isActive: true,
    });
    expect(updated.triggeredAt).toBeUndefined();
    expect(updated.triggeredPrice).toBeUndefined();
    expect(updated.snoozedUntil).toBeUndefined();
    expect(Date.parse(updated.createdAt)).toBeGreaterThanOrEqual(
      Date.parse("2026-08-02T00:00:00.000Z"),
    );
  });

  it("clears distributorId when patched to null", async () => {
    const { storage } = makeStorage();
    await storage.addAlert(alert("a1", { distributorId: "server2u" }));
    await storage.updateAlert("a1", { distributorId: null });
    expect(byId(await storage.getAlerts(), "a1")!.distributorId).toBeUndefined();
  });

  it("leaves omitted fields untouched", async () => {
    const { storage } = makeStorage();
    await storage.addAlert(alert("a1", { targetPrice: 500, currency: "USD" }));
    await storage.updateAlert("a1", { targetPrice: 450 });
    const updated = byId(await storage.getAlerts(), "a1")!;
    expect(updated.targetPrice).toBe(450);
    expect(updated.currency).toBe("USD");
  });

  it("ignores an unknown id", async () => {
    const { storage } = makeStorage();
    await storage.addAlert(alert("a1"));
    await storage.updateAlert("missing", { targetPrice: 1 });
    expect(byId(await storage.getAlerts(), "a1")!.targetPrice).toBe(500);
  });
});

describe("rearmAlert", () => {
  it("reactivates, clears trigger/snooze, and re-stamps createdAt", async () => {
    const { storage } = makeStorage();
    await storage.addAlert(
      alert("a1", {
        isActive: false,
        triggeredAt: "2026-08-02T00:00:00.000Z",
        triggeredPrice: 480,
        snoozedUntil: "2026-08-05T00:00:00.000Z",
      }),
    );
    await storage.rearmAlert("a1");
    const rearmed = byId(await storage.getAlerts(), "a1")!;
    expect(rearmed.isActive).toBe(true);
    expect(rearmed.triggeredAt).toBeUndefined();
    expect(rearmed.triggeredPrice).toBeUndefined();
    expect(rearmed.snoozedUntil).toBeUndefined();
    expect(Date.parse(rearmed.createdAt)).toBeGreaterThanOrEqual(
      Date.parse("2026-08-02T00:00:00.000Z"),
    );
  });
});

describe("deactivateAlert", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("transitions once and records the trigger price", async () => {
    const { storage } = makeStorage();
    await storage.addAlert(alert("a1"));
    expect(await storage.deactivateAlert("a1", 480)).toBe(true);
    const deactivated = byId(await storage.getAlerts(), "a1")!;
    expect(deactivated.isActive).toBe(false);
    expect(deactivated.triggeredPrice).toBe(480);
    expect(deactivated.triggeredAt).toBeDefined();
  });

  it("returns false on an already-triggered alert (compare-and-set)", async () => {
    const { storage } = makeStorage();
    await storage.addAlert(alert("a1"));
    await storage.deactivateAlert("a1", 480);
    expect(await storage.deactivateAlert("a1", 470)).toBe(false);
    expect(byId(await storage.getAlerts(), "a1")!.triggeredPrice).toBe(480);
  });

  it("returns false for an unknown id", async () => {
    const { storage } = makeStorage();
    expect(await storage.deactivateAlert("missing", 1)).toBe(false);
  });

  it("ignores an event older than a re-armed alert's createdAt", async () => {
    const { storage } = makeStorage();
    await storage.addAlert(alert("a1", { createdAt: "2026-08-10T00:00:00.000Z" }));
    const staleEvent = Date.parse("2026-08-09T00:00:00.000Z");
    expect(await storage.deactivateAlert("a1", 480, staleEvent)).toBe(false);
    expect(byId(await storage.getAlerts(), "a1")!.isActive).toBe(true);
  });

  it("honors an event at or after the alert's createdAt", async () => {
    const { storage } = makeStorage();
    await storage.addAlert(alert("a1", { createdAt: "2026-08-10T00:00:00.000Z" }));
    const freshEvent = Date.parse("2026-08-10T00:00:00.000Z");
    expect(await storage.deactivateAlert("a1", 480, freshEvent)).toBe(true);
  });

  it("deactivates when createdAt is unparseable", async () => {
    const { storage } = makeStorage();
    await storage.addAlert(alert("a1", { createdAt: "not-a-date" }));
    expect(await storage.deactivateAlert("a1", 480, Date.now())).toBe(true);
  });
});
