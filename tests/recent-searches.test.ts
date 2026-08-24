import { describe, expect, it } from "vitest";
import {
  clearRecentSearches,
  getRecentSearches,
  recordSearch,
  type KeyValueStore,
} from "../lib/recent-searches";

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
    async removeItem(key) {
      data.delete(key);
    },
  };
}

describe("recent searches", () => {
  it("records queries most-recent-first", async () => {
    const store = memoryStore();
    await recordSearch("crs326", store);
    await recordSearch("hAP ax2", store);
    expect(await getRecentSearches(store)).toEqual(["hAP ax2", "crs326"]);
  });

  it("dedupes case-insensitively and moves to front", async () => {
    const store = memoryStore();
    await recordSearch("CRS326", store);
    await recordSearch("hap", store);
    await recordSearch("crs326 ", store);
    expect(await getRecentSearches(store)).toEqual(["crs326", "hap"]);
  });

  it("caps at 8 entries", async () => {
    const store = memoryStore();
    for (let i = 0; i < 10; i++) await recordSearch(`q${i}`, store);
    const list = await getRecentSearches(store);
    expect(list).toHaveLength(8);
    expect(list[0]).toBe("q9");
  });

  it("ignores empty queries", async () => {
    const store = memoryStore();
    await recordSearch("   ", store);
    expect(await getRecentSearches(store)).toEqual([]);
  });

  it("clears all entries", async () => {
    const store = memoryStore();
    await recordSearch("crs326", store);
    await clearRecentSearches(store);
    expect(await getRecentSearches(store)).toEqual([]);
  });
});
