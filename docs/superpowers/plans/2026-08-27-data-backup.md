# Data Export/Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export watchlist/alerts/reminders/stock-watches/settings to a versioned JSON file and import it back with merge-by-id semantics, from a new "Data" section in Settings.

**Architecture:** Pure backup logic (`lib/backup.ts`, TDD) separated from platform transport (`lib/backup-files.ts`: share sheet/download + document picker/file input). A thin `DataSection` component wires both into Settings. Imports stamp sync-meta so signed-in users' imports win LWW.

**Tech Stack:** Expo (file-system, sharing, document-picker), TypeScript strict, vitest.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/backup.ts` | `buildBackup`, `parseBackup`, `applyBackup` (pure) |
| `tests/backup.test.ts` | Round-trip, validation, merge tests |
| `lib/backup-files.ts` | `exportBackupFile`, `pickBackupFile` platform IO |
| `components/settings/data-section.tsx` | Export/Import rows + dialogs |
| `app/(tabs)/settings.tsx` | Render `<DataSection />` |

**Existing patterns:** `SectionHeader`/`SettingRow` components; `showAlert(title, message, buttons)` from `@/lib/alert`; haptics guard `Platform.OS !== "web"`; storage named exports (`getWatchlist`, `saveWatchlist`, `getAlerts`, `saveAlerts`, `getBackOrderReminders`, `saveBackOrderReminders`, `getStockWatches`, `saveStockWatches`, `getSettings`, `saveSettings`, `setItemSyncMeta`).

---

## Task 1: Install deps + pure backup module (TDD)

**Files:**
- Modify: `package.json`
- Create: `lib/backup.ts`
- Test: `tests/backup.test.ts`

- [ ] **Step 1: Install packages**

```bash
pnpm add expo-file-system expo-sharing expo-document-picker
```

- [ ] **Step 2: Write failing test `tests/backup.test.ts`**

```typescript
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
    expect(result.watchlist.map((p) => p.id).sort()).toEqual([
      "p0",
      "p1",
      "p2",
    ]);
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
```

Note: adjust fixture casts to match real types in `lib/types.ts` if required fields differ — `pnpm check` will say.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/backup.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Create `lib/backup.ts`**

```typescript
import type {
  AppSettings,
  BackOrderReminder,
  PriceAlert,
  Product,
} from "./types";

export const BACKUP_FORMAT = "product-stock-finder-backup";
export const BACKUP_VERSION = 1;

export interface BackupInput {
  watchlist: Product[];
  alerts: PriceAlert[];
  reminders: BackOrderReminder[];
  stockWatches: BackOrderReminder[];
  settings: AppSettings;
}

export interface BackupData {
  format: string;
  version: number;
  exportedAt: string;
  watchlist: Product[];
  alerts: PriceAlert[];
  reminders: BackOrderReminder[];
  stockWatches: BackOrderReminder[];
  settings?: AppSettings;
}

export function buildBackup(input: BackupInput): string {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      watchlist: input.watchlist,
      alerts: input.alerts,
      reminders: input.reminders,
      stockWatches: input.stockWatches,
      settings: input.settings,
    },
    null,
    2,
  );
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function parseBackup(json: string): BackupData | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.format !== BACKUP_FORMAT) return null;
  if (typeof obj.version !== "number" || obj.version > BACKUP_VERSION) {
    return null;
  }
  return {
    format: BACKUP_FORMAT,
    version: obj.version,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "",
    watchlist: asArray<Product>(obj.watchlist),
    alerts: asArray<PriceAlert>(obj.alerts),
    reminders: asArray<BackOrderReminder>(obj.reminders),
    stockWatches: asArray<BackOrderReminder>(obj.stockWatches),
    settings:
      obj.settings && typeof obj.settings === "object"
        ? (obj.settings as AppSettings)
        : undefined,
  };
}

export interface MergeCounts {
  watchlistAdded: number;
  watchlistUpdated: number;
  alertsAdded: number;
  alertsUpdated: number;
  remindersAdded: number;
  remindersUpdated: number;
  stockWatchesAdded: number;
  stockWatchesUpdated: number;
}

export interface ApplyResult {
  watchlist: Product[];
  alerts: PriceAlert[];
  reminders: BackOrderReminder[];
  stockWatches: BackOrderReminder[];
  settings: AppSettings;
  settingsApplied: boolean;
  counts: MergeCounts;
  touchedIds: {
    watchlist: string[];
    alerts: string[];
    reminders: string[];
    stockWatches: string[];
  };
}

interface MergeOutcome<T> {
  merged: T[];
  added: number;
  updated: number;
  touched: string[];
}

// Union keyed on id; incoming (backup) copy wins conflicts; device-only items stay.
function mergeById<T extends { id: string }>(
  current: T[],
  incoming: T[],
): MergeOutcome<T> {
  const map = new Map<string, T>();
  for (const item of current) map.set(item.id, item);
  let added = 0;
  let updated = 0;
  const touched: string[] = [];
  for (const item of incoming) {
    if (map.has(item.id)) updated += 1;
    else added += 1;
    map.set(item.id, item);
    touched.push(item.id);
  }
  return { merged: [...map.values()], added, updated, touched };
}

export function applyBackup(
  backup: BackupData,
  current: BackupInput,
): ApplyResult {
  const watchlist = mergeById(current.watchlist, backup.watchlist);
  const alerts = mergeById(current.alerts, backup.alerts);
  const reminders = mergeById(current.reminders, backup.reminders);
  const stockWatches = mergeById(current.stockWatches, backup.stockWatches);

  const settingsApplied = backup.settings !== undefined;
  const settings: AppSettings = settingsApplied
    ? {
        ...current.settings,
        ...backup.settings!,
        tagDefinitions: backup.settings!.tagDefinitions
          ? {
              ...(current.settings.tagDefinitions ?? {}),
              ...backup.settings!.tagDefinitions,
            }
          : current.settings.tagDefinitions,
      }
    : current.settings;

  return {
    watchlist: watchlist.merged,
    alerts: alerts.merged,
    reminders: reminders.merged,
    stockWatches: stockWatches.merged,
    settings,
    settingsApplied,
    counts: {
      watchlistAdded: watchlist.added,
      watchlistUpdated: watchlist.updated,
      alertsAdded: alerts.added,
      alertsUpdated: alerts.updated,
      remindersAdded: reminders.added,
      remindersUpdated: reminders.updated,
      stockWatchesAdded: stockWatches.added,
      stockWatchesUpdated: stockWatches.updated,
    },
    touchedIds: {
      watchlist: watchlist.touched,
      alerts: alerts.touched,
      reminders: reminders.touched,
      stockWatches: stockWatches.touched,
    },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/backup.test.ts` — PASS.
Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml lib/backup.ts tests/backup.test.ts && git commit -m "feat: add pure backup module with merge-by-id import"
```

---

## Task 2: Platform transport

**Files:**
- Create: `lib/backup-files.ts`

- [ ] **Step 1: Create `lib/backup-files.ts`**

```typescript
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

function backupFileName(): string {
  return `product-stock-finder-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export async function exportBackupFile(json: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = backupFileName();
      anchor.click();
      URL.revokeObjectURL(url);
      return true;
    }
    const uri = `${FileSystem.cacheDirectory}${backupFileName()}`;
    await FileSystem.writeAsStringAsync(uri, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, {
      mimeType: "application/json",
      dialogTitle: "Export Backup",
    });
    return true;
  } catch {
    return false;
  }
}

export async function pickBackupFile(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return await new Promise<string | null>((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return resolve(null);
          const reader = new FileReader();
          reader.onload = () =>
            resolve(typeof reader.result === "string" ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsText(file);
        };
        input.oncancel = () => resolve(null);
        input.click();
      });
    }
    // Some Android providers report backups as octet-stream/text — accept broadly.
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/json", "text/plain", "application/octet-stream"],
    });
    if (result.canceled || result.assets.length === 0) return null;
    return await FileSystem.readAsStringAsync(result.assets[0].uri);
  } catch {
    return null;
  }
}
```

If the installed `expo-document-picker` version exposes the legacy `{ type, uri }` result shape instead of `{ canceled, assets }`, adapt to whichever `pnpm check` confirms (v13+ uses assets).

- [ ] **Step 2: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/backup-files.ts && git commit -m "feat: add backup file transport (share sheet, download, picker)"
```

---

## Task 3: Data section UI + wiring + push

**Files:**
- Create: `components/settings/data-section.tsx`
- Modify: `app/(tabs)/settings.tsx`
- Modify: `todo.md`

- [ ] **Step 1: Create `components/settings/data-section.tsx`**

```typescript
import { useState } from "react";
import { View } from "react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { SectionHeader } from "@/components/settings/section-header";
import { SettingRow } from "@/components/settings/setting-row";
import { showAlert } from "@/lib/alert";
import {
  getAlerts,
  getBackOrderReminders,
  getSettings,
  getStockWatches,
  getWatchlist,
  saveAlerts,
  saveBackOrderReminders,
  saveSettings,
  saveStockWatches,
  saveWatchlist,
  setItemSyncMeta,
} from "@/lib/storage";
import { applyBackup, buildBackup, parseBackup } from "@/lib/backup";
import { exportBackupFile, pickBackupFile } from "@/lib/backup-files";

async function performExport(): Promise<boolean> {
  const [watchlist, alerts, reminders, stockWatches, settings] =
    await Promise.all([
      getWatchlist(),
      getAlerts(),
      getBackOrderReminders(),
      getStockWatches(),
      getSettings(),
    ]);
  const json = buildBackup({
    watchlist,
    alerts,
    reminders,
    stockWatches,
    settings,
  });
  return exportBackupFile(json);
}

function tapHaptic() {
  if (Platform.OS !== "web")
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function DataSection() {
  const colors = useColors();
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    tapHaptic();
    setBusy(true);
    try {
      const ok = await performExport();
      showAlert(
        ok ? "Backup Exported" : "Export Failed",
        ok
          ? "Your backup file has been created."
          : "Could not create the backup file on this device.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    tapHaptic();
    setBusy(true);
    try {
      const contents = await pickBackupFile();
      if (!contents) return;
      const backup = parseBackup(contents);
      if (!backup) {
        showAlert(
          "Invalid Backup",
          "That file is not a valid Product Stock Finder backup.",
        );
        return;
      }
      const [watchlist, alerts, reminders, stockWatches, settings] =
        await Promise.all([
          getWatchlist(),
          getAlerts(),
          getBackOrderReminders(),
          getStockWatches(),
          getSettings(),
        ]);
      const result = applyBackup(backup, {
        watchlist,
        alerts,
        reminders,
        stockWatches,
        settings,
      });
      const c = result.counts;
      const summary = [
        `Watchlist: +${c.watchlistAdded} new, ${c.watchlistUpdated} updated`,
        `Alerts: +${c.alertsAdded} new, ${c.alertsUpdated} updated`,
        `Reminders: +${c.remindersAdded} new, ${c.remindersUpdated} updated`,
        `Stock watches: +${c.stockWatchesAdded} new, ${c.stockWatchesUpdated} updated`,
      ].join("\n");
      showAlert("Import Backup?", summary, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Import",
          onPress: async () => {
            setBusy(true);
            try {
              await saveWatchlist(result.watchlist);
              await saveAlerts(result.alerts);
              await saveBackOrderReminders(result.reminders);
              await saveStockWatches(result.stockWatches);
              if (result.settingsApplied) await saveSettings(result.settings);
              const now = Date.now();
              for (const id of result.touchedIds.watchlist)
                await setItemSyncMeta("watchlist", id, now);
              for (const id of result.touchedIds.alerts)
                await setItemSyncMeta("alerts", id, now);
              for (const id of result.touchedIds.reminders)
                await setItemSyncMeta("reminders", id, now);
              for (const id of result.touchedIds.stockWatches)
                await setItemSyncMeta("reminders", id, now);
              showAlert("Backup Imported", summary);
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionHeader title="Data" />
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          marginHorizontal: 16,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        <SettingRow
          icon="square.and.arrow.up"
          label="Export Backup"
          description="Save watchlist, alerts and settings to a file"
          right={
            <TouchableOpacity
              onPress={handleExport}
              disabled={busy}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: colors.primary + "22",
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                {busy ? "…" : "Export"}
              </Text>
            </TouchableOpacity>
          }
        />
        <SettingRow
          icon="square.and.arrow.down"
          label="Import Backup"
          description="Restore from a backup file (merges by id)"
          right={
            <TouchableOpacity
              onPress={handleImport}
              disabled={busy}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: colors.primary + "22",
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                Import
              </Text>
            </TouchableOpacity>
          }
        />
      </View>
    </>
  );
}
```

Add missing imports at top (`TouchableOpacity`, `Text` from react-native). Verify icon names `square.and.arrow.up` / `square.and.arrow.down` exist in `components/ui/icon-symbol.tsx` mappings — if not, add SF→Material pairs (e.g. `"square.and.arrow.up": "share"`, `"square.and.arrow.down": "download"`) or reuse already-mapped icons.

Note: stock watches are stored in the `reminders` sync collection (same collection, different storage key) — hence `setItemSyncMeta("reminders", …)` for them.

- [ ] **Step 2: Render in `app/(tabs)/settings.tsx`**

After `<DeviceManagementSection … />` add:

```tsx
        <DataSection />
```

with import `import { DataSection } from "@/components/settings/data-section";`.

- [ ] **Step 3: Verify**

Run: `pnpm check` — 0 errors.
Run: `pnpm lint` — no new errors.
Run: `pnpm test` — all pass.

- [ ] **Step 4: Update `todo.md`**

Append Phase 80 section:

```markdown
## Phase 80: Data Export/Import (v5.28)

- [x] Add pure backup module (build/parse/apply, merge-by-id) with unit tests
- [x] Add platform file transport (share sheet, web download, document picker/upload)
- [x] Add Data section to Settings with Export/Import rows
- [x] Stamp sync-meta on import so signed-in imports win LWW
```

- [ ] **Step 5: Commit and push**

```bash
git add components/settings/data-section.tsx "app/(tabs)/settings.tsx" todo.md && git commit -m "feat: add data export/import to settings"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New pure module | `lib/backup.ts` (~180 lines) |
| New tests | `tests/backup.test.ts` (~9 cases) |
| New transport | `lib/backup-files.ts` (~80 lines) |
| New UI | `components/settings/data-section.tsx` |
| New deps | expo-file-system, expo-sharing, expo-document-picker |
