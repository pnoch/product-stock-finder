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
import { addRecentSearch, parseRecentSearches, MAX_RECENT_SEARCHES } from "../lib/recent-searches";

describe("recent searches pure core", () => {
  it("caps at MAX_RECENT_SEARCHES", () => {
    expect(MAX_RECENT_SEARCHES).toBe(8);
    const list = Array.from({ length: 8 }, (_, i) => `q${i}`);
    expect(addRecentSearch(list, "new")).toEqual(["new", "q0", "q1", "q2", "q3", "q4", "q5", "q6"]);
  });
  it("dedups case-insensitively and trims", () => {
    expect(addRecentSearch(["CRS326"], "  crs326 ")).toEqual(["crs326"]);
  });
  it("returns current list on blank query", () => {
    expect(addRecentSearch(["a"], "   ")).toEqual(["a"]);
  });
  it("parses garbage to []", () => {
    expect(parseRecentSearches(null)).toEqual([]);
    expect(parseRecentSearches("not json")).toEqual([]);
    expect(parseRecentSearches('{"a":1}')).toEqual([]);
    expect(parseRecentSearches('["a",1,"b"]')).toEqual(["a", "b"]);
  });
});
