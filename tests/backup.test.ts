import { describe, expect, it } from "vitest";
import {
  applyBackup,
  buildBackup,
  parseBackup,
  BACKUP_FORMAT,
} from "../lib/backup";
import type {
  AppSettings,
  BackOrderReminder,
  PriceAlert,
  Product,
} from "../lib/types";

const NOW = "2026-08-27T00:00:00.000Z";

function product(id: string): Product {
  return {
    id,
    name: `Product ${id}`,
    brand: "MikroTik",
    category: "Routers",
    modelNumber: id.toUpperCase(),
    description: "",
    isWatched: true,
    addedAt: NOW,
    listings: [],
  } as unknown as Product;
}

function alert(id: string, targetPrice = 100): PriceAlert {
  return {
    id,
    productId: "p1",
    targetPrice,
    currency: "USD",
    isActive: true,
    createdAt: NOW,
  } as unknown as PriceAlert;
}

function reminder(id: string): BackOrderReminder {
  return {
    id,
    productId: "p1",
    distributorId: "mikrotikstore",
    reminderDate: NOW,
    createdAt: NOW,
    reminderType: "date",
  } as unknown as BackOrderReminder;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "auto",
  displayCurrency: "USD",
  checkInterval: "manual",
  notificationsEnabled: true,
  stockAlerts: true,
  priceAlerts: true,
  healthAlerts: true,
  shippingRegion: "Asia-Pacific",
  webNotificationsEnabled: false,
  watchlistSort: "recent",
  watchlistGroup: "off",
};

describe("buildBackup / parseBackup round-trip", () => {
  it("preserves all collections through serialize + parse", () => {
    const json = buildBackup({
      watchlist: [product("p1")],
      alerts: [alert("a1")],
      reminders: [reminder("r1")],
      stockWatches: [reminder("w1")],
      settings: DEFAULT_SETTINGS,
    });
    const parsed = parseBackup(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.format).toBe("product-stock-finder-backup");
    expect(parsed!.version).toBe(1);
    expect(parsed!.watchlist.map((p) => p.id)).toEqual(["p1"]);
    expect(parsed!.alerts.map((a) => a.id)).toEqual(["a1"]);
    expect(parsed!.reminders.map((r) => r.id)).toEqual(["r1"]);
    expect(parsed!.stockWatches.map((r) => r.id)).toEqual(["w1"]);
    expect(parsed!.settings?.displayCurrency).toBe("USD");
  });

  it("embeds an exportedAt timestamp", () => {
    const parsed = parseBackup(
      buildBackup({
        watchlist: [],
        alerts: [],
        reminders: [],
        stockWatches: [],
        settings: DEFAULT_SETTINGS,
      }),
    );
    expect(parsed!.exportedAt).toBeTruthy();
  });
});

describe("parseBackup validation", () => {
  it("rejects garbage JSON", () => {
    expect(parseBackup("not json")).toBeNull();
  });

  it("rejects wrong format marker", () => {
    expect(parseBackup(JSON.stringify({ format: "other", version: 1 }))).toBeNull();
  });

  it("rejects future versions", () => {
    expect(
      parseBackup(
        JSON.stringify({ format: "product-stock-finder-backup", version: 99 }),
      ),
    ).toBeNull();
  });

  it("coerces malformed collections to empty arrays", () => {
    const parsed = parseBackup(
      JSON.stringify({
        format: "product-stock-finder-backup",
        version: 1,
        watchlist: "nope",
        alerts: 42,
      }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.watchlist).toEqual([]);
    expect(parsed!.alerts).toEqual([]);
    expect(parsed!.reminders).toEqual([]);
    expect(parsed!.stockWatches).toEqual([]);
    expect(parsed!.settings).toBeUndefined();
  });
});

describe("applyBackup watchlist listing merge", () => {
  const listing = (
    distributorId: string,
    price: number,
    lastChecked: string,
  ) => ({
    distributorId,
    productId: "p1",
    price,
    currency: "USD",
    stockStatus: "in_stock" as const,
    url: `https://example.com/${distributorId}`,
    lastChecked,
    priceHistory: [],
  });

  it("keeps the newer local price instead of resurrecting the backup's stale one", () => {
    const local = product("p1");
    local.listings = [listing("d1", 480, "2026-08-26T00:00:00.000Z")];
    const backupProduct = product("p1");
    backupProduct.listings = [listing("d1", 500, "2026-08-20T00:00:00.000Z")];

    const result = applyBackup(
      {
        version: 1,
        exportedAt: NOW,
        watchlist: [backupProduct],
        alerts: [],
        reminders: [],
        stockWatches: [],
      } as never,
      {
        watchlist: [local],
        alerts: [],
        reminders: [],
        stockWatches: [],
        settings: undefined,
      } as never,
    );

    const merged = result.watchlist.find((p) => p.id === "p1")!;
    // A wholesale replace used to erase the fresher price and push it everywhere.
    expect(merged.listings[0]!.price).toBe(480);
    expect(merged.listings[0]!.lastChecked).toBe("2026-08-26T00:00:00.000Z");
  });

  it("keeps the local listing on a lastChecked tie", () => {
    // On equal timestamps the backup merge prefers the device copy (`>=`),
    // whereas the Rust file-mirror merge prefers the incoming/UI copy (`>`).
    // Pinned here so a future "unify the merges" change is deliberate.
    const local = product("p1");
    local.listings = [listing("d1", 480, "2026-08-26T00:00:00.000Z")];
    const backupProduct = product("p1");
    backupProduct.listings = [listing("d1", 500, "2026-08-26T00:00:00.000Z")];

    const result = applyBackup(
      {
        version: 1,
        exportedAt: NOW,
        watchlist: [backupProduct],
        alerts: [],
        reminders: [],
        stockWatches: [],
      } as never,
      {
        watchlist: [local],
        alerts: [],
        reminders: [],
        stockWatches: [],
        settings: undefined,
      } as never,
    );

    const merged = result.watchlist.find((p) => p.id === "p1")!;
    expect(merged.listings[0]!.price).toBe(480);
  });

  it("compares lastChecked by parsed time across ISO formats", () => {
    // `"…T00:00:00Z" >= "…T00:00:00.500Z"` lexically, but the .500Z listing is
    // chronologically newer, so the string comparison kept the older local one.
    const local = product("p1");
    local.listings = [listing("d1", 100, "2026-08-26T00:00:00Z")];
    const backupProduct = product("p1");
    backupProduct.listings = [
      listing("d1", 200, "2026-08-26T00:00:00.500Z"),
    ];

    const result = applyBackup(
      {
        version: 1,
        exportedAt: NOW,
        watchlist: [backupProduct],
        alerts: [],
        reminders: [],
        stockWatches: [],
      } as never,
      {
        watchlist: [local],
        alerts: [],
        reminders: [],
        stockWatches: [],
        settings: undefined,
      } as never,
    );

    const merged = result.watchlist.find((p) => p.id === "p1")!;
    expect(merged.listings[0]!.price).toBe(200);
  });

  it("takes the backup's newer price and keeps a device-only listing", () => {
    const local = product("p1");
    local.listings = [listing("d-only", 100, "2026-08-20T00:00:00.000Z")];
    const backupProduct = product("p1");
    backupProduct.listings = [listing("d1", 400, "2026-08-26T00:00:00.000Z")];

    const result = applyBackup(
      {
        version: 1,
        exportedAt: NOW,
        watchlist: [backupProduct],
        alerts: [],
        reminders: [],
        stockWatches: [],
      } as never,
      {
        watchlist: [local],
        alerts: [],
        reminders: [],
        stockWatches: [],
        settings: undefined,
      } as never,
    );

    const merged = result.watchlist.find((p) => p.id === "p1")!;
    expect(merged.listings.map((l) => l.distributorId).sort()).toEqual([
      "d-only",
      "d1",
    ]);
    expect(merged.listings.find((l) => l.distributorId === "d1")!.price).toBe(400);
  });
});

describe("applyBackup merge-by-id", () => {
  it("adds new, updates existing, preserves device-only items", () => {
    const backup = parseBackup(
      buildBackup({
        watchlist: [product("p1"), product("p2")],
        alerts: [alert("a1", 50)],
        reminders: [],
        stockWatches: [],
        settings: DEFAULT_SETTINGS,
      }),
    )!;
    const result = applyBackup(backup, {
      watchlist: [product("p0"), product("p1")],
      alerts: [alert("a1", 100), alert("a9")],
      reminders: [],
      stockWatches: [],
      settings: DEFAULT_SETTINGS,
    });
    expect(result.watchlist.map((p) => p.id).sort()).toEqual(["p0", "p1", "p2"]);
    expect(result.counts.watchlistAdded).toBe(1);
    expect(result.counts.watchlistUpdated).toBe(1);
    expect(result.alerts.find((a) => a.id === "a1")!.targetPrice).toBe(50);
    expect(result.alerts.some((a) => a.id === "a9")).toBe(true);
    expect(result.touchedIds.watchlist.sort()).toEqual(["p1", "p2"]);
    expect(result.touchedIds.alerts).toEqual(["a1"]);
  });

  it("shallow-merges settings with backup winning, merges tag definitions by id", () => {
    const backupSettings = {
      ...DEFAULT_SETTINGS,
      displayCurrency: "EUR" as const,
      tagDefinitions: {
        t1: { id: "t1", name: "Router", color: "#ff0000" },
        t2: { id: "t2", name: "New", color: "#00ff00" },
      },
    };
    const backup = parseBackup(
      buildBackup({
        watchlist: [],
        alerts: [],
        reminders: [],
        stockWatches: [],
        settings: backupSettings,
      }),
    )!;
    const result = applyBackup(backup, {
      watchlist: [],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: {
        ...DEFAULT_SETTINGS,
        theme: "dark" as const,
        tagDefinitions: {
          t1: { id: "t1", name: "Old Name", color: "#0000ff" },
          t3: { id: "t3", name: "Local Only", color: "#ffff00" },
        },
      },
    });
    expect(result.settings.displayCurrency).toBe("EUR");
    expect(result.settings.theme).toBe("dark");
    expect(result.settings.tagDefinitions!["t1"].name).toBe("Router");
    expect(result.settings.tagDefinitions!["t3"].name).toBe("Local Only");
    expect(result.settingsApplied).toBe(true);
  });

  it("leaves settings untouched when backup has none", () => {
    const json = JSON.stringify({
      format: "product-stock-finder-backup",
      version: 1,
      watchlist: [],
    });
    const result = applyBackup(parseBackup(json)!, {
      watchlist: [],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: DEFAULT_SETTINGS,
    });
    expect(result.settingsApplied).toBe(false);
    expect(result.settings.theme).toBe("auto");
  });

  it("does not clobber a local customization with the exporter's default", () => {
    // The backup carries the exporter's default shippingRegion/watchlistSort;
    // the importing device has customized both. Default-valued fields must not
    // overwrite local values.
    const backup = parseBackup(
      buildBackup({
        watchlist: [],
        alerts: [],
        reminders: [],
        stockWatches: [],
        settings: { ...DEFAULT_SETTINGS },
      }),
    )!;
    const result = applyBackup(backup, {
      watchlist: [],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: {
        ...DEFAULT_SETTINGS,
        shippingRegion: "Europe",
        watchlistSort: "best_price",
      },
    });
    expect(result.settings.shippingRegion).toBe("Europe");
    expect(result.settings.watchlistSort).toBe("best_price");
  });

  it("still applies a non-default value from the backup", () => {
    const backup = parseBackup(
      buildBackup({
        watchlist: [],
        alerts: [],
        reminders: [],
        stockWatches: [],
        settings: { ...DEFAULT_SETTINGS, shippingRegion: "Americas" },
      }),
    )!;
    const result = applyBackup(backup, {
      watchlist: [],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: { ...DEFAULT_SETTINGS, shippingRegion: "Europe" },
    });
    expect(result.settings.shippingRegion).toBe("Americas");
  });
});

describe("BYO-LLM key is device-local", () => {
  it("omits the API key from an exported backup", () => {
    const json = buildBackup({
      watchlist: [],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: { ...DEFAULT_SETTINGS, llmApiKey: "sk-secret-token" },
    });
    expect(json).not.toContain("sk-secret-token");
    expect(parseBackup(json)!.settings?.llmApiKey).toBeUndefined();
  });

  it("never adopts a key from an imported backup", () => {
    const crafted = JSON.stringify({
      format: "product-stock-finder-backup",
      version: 1,
      exportedAt: NOW,
      watchlist: [],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: { ...DEFAULT_SETTINGS, llmApiKey: "sk-from-file" },
    });
    const parsed = parseBackup(crafted)!;
    expect(parsed.settings?.llmApiKey).toBeUndefined();
    const result = applyBackup(parsed, {
      watchlist: [],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: { ...DEFAULT_SETTINGS, llmApiKey: "sk-local" },
    });
    expect(result.settings.llmApiKey).toBe("sk-local");
  });
});

describe("parseBackup item validation", () => {
  it("drops items without a usable string id", () => {
    const json = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: NOW,
      watchlist: [{ id: "ok", name: "P" }, { name: "no-id" }, { id: 42 }],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: {},
    });
    const parsed = parseBackup(json)!;
    // An id-less row used to collide on one `undefined` key, write a bogus
    // sync-meta entry, and retry forever as a server validation rejection.
    expect(parsed.watchlist.map((p) => p.id)).toEqual(["ok"]);
  });
});

describe("SETTING_DEFAULTS coverage", () => {
  it("lists every defaulted AppSettings field", async () => {
    // A field in DEFAULT_SETTINGS but not SETTING_DEFAULTS is always taken from
    // the backup, silently overwriting the local value with the exporter's
    // default. This is a manual-sync invariant, so pin it.
    const { readFile } = await import("node:fs/promises");
    const settingsSrc = await readFile("lib/storage/settings.ts", "utf8");
    const backupSrc = await readFile("lib/backup.ts", "utf8");
    const keysIn = (src: string, marker: string): string[] => {
      const start = src.indexOf(marker);
      const block = src.slice(start, src.indexOf("};", start));
      return [...block.matchAll(/^\s*([a-zA-Z]+):/gm)].map((m) => m[1]!);
    };
    const defaults = keysIn(settingsSrc, "const DEFAULT_SETTINGS");
    const settingDefaults = keysIn(backupSrc, "const SETTING_DEFAULTS");
    expect(defaults.length).toBeGreaterThan(5);
    for (const key of defaults) {
      expect(settingDefaults, `missing SETTING_DEFAULTS.${key}`).toContain(key);
    }
  });
});
