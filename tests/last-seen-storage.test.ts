import { describe, expect, it, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: async (k: string) => {
      store.delete(k);
    },
    multiRemove: async (ks: string[]) => {
      ks.forEach((k) => store.delete(k));
    },
  },
}));

import { getLastSeenAt, setLastSeenAt, clearAllData } from "../lib/storage";

beforeEach(() => store.clear());

describe("last seen at", () => {
  it("round-trips a timestamp", async () => {
    await setLastSeenAt(1_700_000_000_000);
    expect(await getLastSeenAt()).toBe(1_700_000_000_000);
  });
  it("returns null when never set", async () => {
    expect(await getLastSeenAt()).toBeNull();
  });
  it("returns null for a corrupt value", async () => {
    store.set("last_seen_at", "nope");
    expect(await getLastSeenAt()).toBeNull();
  });
  it("is wiped by clearAllData", async () => {
    await setLastSeenAt(1_700_000_000_000);
    await clearAllData();
    expect(await getLastSeenAt()).toBeNull();
  });
});
