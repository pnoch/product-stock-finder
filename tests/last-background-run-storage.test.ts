import { describe, expect, it, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => store.delete(k));
    },
  },
}));

import { getLastBackgroundRun, setLastBackgroundRun } from "../lib/storage";

beforeEach(() => {
  store.clear();
});

describe("last background run", () => {
  it("round-trips a timestamp", async () => {
    await setLastBackgroundRun(1_700_000_000_000);
    expect(await getLastBackgroundRun()).toBe(1_700_000_000_000);
  });

  it("returns null when never set", async () => {
    expect(await getLastBackgroundRun()).toBeNull();
  });
});
