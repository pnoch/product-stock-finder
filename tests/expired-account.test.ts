import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, string>());
const clearAccountData = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
}));

vi.mock("@/lib/storage", () => ({ clearAccountData }));

import {
  clearExpiredAccount,
  reconcileExpiredAccount,
  rememberExpiredAccount,
  takeExpiredAccount,
} from "@/lib/expired-account";

describe("lib/expired-account", () => {
  beforeEach(() => {
    store.clear();
    clearAccountData.mockClear();
  });

  it("remembers and takes the expired account id once", async () => {
    await rememberExpiredAccount(42);
    await expect(takeExpiredAccount()).resolves.toBe(42);
    await expect(takeExpiredAccount()).resolves.toBeNull();
  });

  it("clears the marker without returning it", async () => {
    await rememberExpiredAccount(42);
    await clearExpiredAccount();
    await expect(takeExpiredAccount()).resolves.toBeNull();
  });

  it("keeps local data when the same account returns", async () => {
    await rememberExpiredAccount(42);
    await reconcileExpiredAccount(42);
    expect(clearAccountData).not.toHaveBeenCalled();
  });

  it("wipes local data when a different account returns", async () => {
    await rememberExpiredAccount(42);
    await reconcileExpiredAccount(7);
    expect(clearAccountData).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no account expired", async () => {
    await reconcileExpiredAccount(7);
    expect(clearAccountData).not.toHaveBeenCalled();
  });
});
