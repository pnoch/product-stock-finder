import { describe, expect, it } from "vitest";
import {
  applyBackup,
  buildBackup,
  parseBackup,
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
});
