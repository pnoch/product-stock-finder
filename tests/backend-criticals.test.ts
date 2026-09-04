import { describe, expect, it, vi } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { UNAUTHED_ERR_MSG } from "../shared/const";
import { createStorage, type StorageAdapter } from "../lib/storage";
import type { Product } from "../lib/types";
import { shouldAcceptSyncWrite } from "../server/sync-db";
import { trendingRouter } from "../server/routers/trending";
import type { TrpcContext } from "../server/_core/context";

function product(id: string): Product {
  return {
    id,
    name: `Product ${id}`,
    modelNumber: id,
    brand: "Test",
    category: "Test",
    description: "",
    addedAt: new Date().toISOString(),
    isWatched: true,
    listings: [],
  };
}

describe("backend release blockers", () => {
  it("has a journaled migration for shared watchlists without duplicate 0019 files", () => {
    const drizzleDir = path.join(process.cwd(), "drizzle");
    const files = readdirSync(drizzleDir).filter((file) => file.endsWith(".sql"));
    expect(files).not.toContain("0019_trending_products.sql");
    const journal = JSON.parse(
      readFileSync(path.join(drizzleDir, "meta", "_journal.json"), "utf8"),
    ) as { entries: Array<{ tag: string }> };
    const tags = journal.entries.map((entry) => entry.tag);
    const migration = tags.find((tag) => tag.startsWith("0020_"));
    expect(migration).toBeDefined();
    const sql = readFileSync(path.join(drizzleDir, `${migration}.sql`), "utf8");
    expect(sql).toContain("CREATE TABLE `shared_watchlists`");
    expect(sql).toContain("CREATE TABLE `shared_watchlist_members`");
    expect(sql).toContain("CREATE TABLE `password_reset_tokens`");
    expect(existsSync(path.join(drizzleDir, `${migration}.sql`))).toBe(true);
  });

  it("requires authentication before refreshing trending products", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);
    const caller = trendingRouter.createCaller({
      user: null,
      req: { headers: {} },
      res: { clearCookie: () => {} },
      deviceId: null,
    } as unknown as TrpcContext);
    await expect(caller.refresh()).rejects.toThrow(UNAUTHED_ERR_MSG);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("does not let a stale legacy write clobber newer server state", () => {
    expect(shouldAcceptSyncWrite(null, 5_000, 4_000)).toBe(false);
    expect(shouldAcceptSyncWrite(null, 1_000, 5_000)).toBe(true);
  });

  it("serializes whole-watchlist saves in call order", async () => {
    const store = new Map<string, string>();
    let writes = 0;
    const adapter: StorageAdapter = {
      getItem: async (key) => store.get(key) ?? null,
      setItem: async (key, value) => {
        // First save is slow; the second is fast. Without queueing, the slow
        // first write would incorrectly win.
        writes += 1;
        await new Promise((resolve) => setTimeout(resolve, writes === 1 ? 20 : 0));
        store.set("watchlist_products", value);
      },
      removeItem: async (key) => {
        store.delete(key);
      },
      multiRemove: async (keys) => {
        keys.forEach((key) => store.delete(key));
      },
    };
    const storage = createStorage(adapter);
    const first = storage.saveWatchlist([product("first")]);
    const second = storage.saveWatchlist([product("second")]);
    await Promise.all([first, second]);
    const saved = JSON.parse(store.get("watchlist_products") ?? "[]") as Product[];
    expect(saved.map((item) => item.id)).toEqual(["second"]);
  });
});
