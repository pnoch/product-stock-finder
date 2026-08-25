import { describe, expect, it } from "vitest";
import {
  hasSeenOnboarding,
  setOnboardingSeen,
  type KeyValueStore,
} from "../lib/onboarding";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async getItem(key) {
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
  };
}

describe("onboarding", () => {
  it("defaults to not seen", async () => {
    expect(await hasSeenOnboarding(memoryStore())).toBe(false);
  });

  it("persists completion", async () => {
    const store = memoryStore();
    await setOnboardingSeen(store);
    expect(await hasSeenOnboarding(store)).toBe(true);
  });
});
