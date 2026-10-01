import { describe, expect, it } from "vitest";
import { createStorage, type Storage } from "../lib/storage";
import type { PendingHealthEvent } from "../lib/storage/notifications";

function makeStorage(): Storage {
  const store = new Map<string, string>();
  return createStorage({
    getItem: async (k) => store.get(k) ?? null,
    setItem: async (k, v) => {
      store.set(k, v);
    },
    removeItem: async (k) => {
      store.delete(k);
    },
    multiRemove: async (keys) => {
      keys.forEach((k) => store.delete(k));
    },
  });
}

function healthEvent(overrides: Partial<PendingHealthEvent> = {}): PendingHealthEvent {
  return {
    distributorId: "server2u-my",
    distributorName: "Server2U",
    status: "blocked",
    title: "Distributor blocked",
    body: "Cloudflare challenge",
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe("pending health events buffer", () => {
  it("starts empty", async () => {
    expect(await makeStorage().getPendingHealthEvents()).toEqual([]);
  });

  it("saves and reads back buffered events", async () => {
    const storage = makeStorage();
    const events = [
      healthEvent(),
      healthEvent({ distributorId: "linitx-uk", status: "error", kind: "recovery" }),
    ];
    await storage.savePendingHealthEvents(events);
    expect(await storage.getPendingHealthEvents()).toEqual(events);
  });

  it("overwrites the buffer on save", async () => {
    const storage = makeStorage();
    await storage.savePendingHealthEvents([healthEvent()]);
    await storage.savePendingHealthEvents([healthEvent({ distributorId: "b" })]);
    const pending = await storage.getPendingHealthEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.distributorId).toBe("b");
  });

  it("clears the buffer", async () => {
    const storage = makeStorage();
    await storage.savePendingHealthEvents([healthEvent()]);
    await storage.clearPendingHealthEvents();
    expect(await storage.getPendingHealthEvents()).toEqual([]);
  });
});
