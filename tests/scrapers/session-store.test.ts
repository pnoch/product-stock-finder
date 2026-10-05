import { describe, expect, it, vi, beforeEach } from "vitest";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
}));

import {
  getUnlocked,
  markUnlocked,
  clearUnlocked,
  clearAllUnlocked,
} from "@/lib/scrapers/session-store";

describe("session-store", () => {
  beforeEach(() => store.clear());

  it("starts empty and marks/clears a distributor", async () => {
    expect(await getUnlocked()).toEqual({});
    await markUnlocked("pbtech-nz");
    const after = await getUnlocked();
    expect(Object.keys(after)).toEqual(["pbtech-nz"]);
    expect(typeof after["pbtech-nz"]).toBe("string");
    await clearUnlocked("pbtech-nz");
    expect(await getUnlocked()).toEqual({});
  });

  it("clearAllUnlocked empties the set", async () => {
    await markUnlocked("a");
    await markUnlocked("b");
    await clearAllUnlocked();
    expect(await getUnlocked()).toEqual({});
  });

  it("tolerates corrupt stored JSON", async () => {
    store.set("session_unlocked", "{not json");
    expect(await getUnlocked()).toEqual({});
  });
});
