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

import { getDeviceId } from "../lib/device-id";

describe("getDeviceId", () => {
  beforeEach(() => store.clear());

  it("generates and persists an id on first call", async () => {
    const id = await getDeviceId();
    expect(id.length).toBeGreaterThan(0);
    expect(store.get("device_id")).toBe(id);
  });

  it("returns the same id on subsequent calls", async () => {
    const first = await getDeviceId();
    const second = await getDeviceId();
    expect(second).toBe(first);
  });

  // A storage failure must not mint a new id per call: the server would see a
  // different device on every request (breaking device binding/revocation).
  it("keeps a stable in-memory id when storage fails", async () => {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const getItemSpy = vi.spyOn(AsyncStorage, "getItem").mockRejectedValue(new Error("blocked"));
    try {
      const first = await getDeviceId();
      const second = await getDeviceId();
      expect(first.length).toBeGreaterThan(0);
      expect(second).toBe(first);
    } finally {
      getItemSpy.mockRestore();
    }
  });

  it("falls back to a generated id when crypto.randomUUID is unavailable", async () => {
    vi.stubGlobal("crypto", undefined);
    try {
      const id = await getDeviceId();
      expect(id.startsWith("dev-")).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
