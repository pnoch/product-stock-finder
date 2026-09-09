# Desktop Full Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop exports/imports full backups (all collections) compatible with mobile.

**Architecture:** Reuse `lib/backup.ts` end-to-end (same format constant, merge, counts); Tauri dialog+fs for files with Blob/file-input fallback; confirm via native `confirm()`; persist + sync-meta stamp + reload like mobile. Existing watchlist-only export untouched. No Rust/mobile changes.

**Tech Stack:** React, Tauri dialog/fs plugins, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-backup-design.md`

---

### Task 1: Guard + round-trip tests

**Files:**
- Create: `tests/desktop-backup.test.ts`

- [ ] **Step 1: Write the tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  BACKUP_FORMAT,
  applyBackup,
  buildBackup,
  parseBackup,
} from "../lib/backup";

describe("desktop full backup", () => {
  it("round-trips through build/parse/apply with merge counts", () => {
    const current = {
      watchlist: [],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: { displayCurrency: "USD" } as never,
    };
    const incoming = {
      watchlist: [
        { id: "p1", name: "Widget", listings: [] },
      ],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: { displayCurrency: "EUR" } as never,
    };
    const json = buildBackup(incoming as never);
    const parsed = parseBackup(json);
    if (!parsed) throw new Error("round-trip parse failed");
    expect(parsed.format).toBe(BACKUP_FORMAT);
    const result = applyBackup(parsed, current as never);
    expect(result.counts.watchlistAdded).toBe(1);
    expect(result.watchlist).toHaveLength(1);
  });

  it("wires export/import buttons with sync-meta stamping", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("Export full backup");
    expect(text).toContain("Import backup");
    expect(text).toContain("setItemSyncMeta");
  });
});
```
Verify `BACKUP_FORMAT` export name/value + `buildBackup`/`parseBackup`/`applyBackup` signatures in `lib/backup.ts` first (lines 24-103 read earlier: `buildBackup(input)`, `parseBackup(json)`, `applyBackup(backup, current)` — confirm `BackupData.format` field exists for the assertion; adjust field name if different).

- [ ] **Step 2: Run tests to verify behavior**

Run: `pnpm vitest run tests/desktop-backup.test.ts 2>&1 | tail -4`
Expected: round-trip PASSES immediately (shared logic already correct — documents the contract); wiring test FAILS.

- [ ] **Step 3: Commit the tests**

```bash
git add tests/desktop-backup.test.ts
git commit -m "test: guard desktop full backup (+ round-trip)"
```

---

### Task 2: Export full backup

**Files:**
- Modify: `desktop/src/pages/Settings.tsx`

- [ ] **Step 1: Add handler + buttons**

Read the Data Management block first (lines 1067-1089: Export/Import Watchlist buttons via handleExport/handleImport from `../import-export`, importExportMessage `<p>`). Add imports: `buildBackup` from `"../../../lib/backup"`. Add state: reuse `importExportMessage` setter pattern (check its setter name — `setImportExportMessage` presumably; verify).
```tsx
  const handleExportBackup = useCallback(async () => {
    try {
      const [watchlist, alerts, reminders, stockWatches, settings] = await Promise.all([
        storage.getWatchlist(),
        storage.getAlerts(),
        storage.getBackOrderReminders(),
        storage.getStockWatches(),
        storage.getSettings(),
      ]);
      const json = buildBackup({ watchlist, alerts, reminders, stockWatches, settings });
      const fileName = `product-stock-finder-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (typeof window !== "undefined" && (window as unknown as { __TAURI__?: unknown }).__TAURI__) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeFile } = await import("@tauri-apps/plugin-fs");
        const filePath = await save({ defaultPath: fileName, filters: [{ name: "JSON", extensions: ["json"] }] });
        if (!filePath) {
          setImportExportMessage("Export cancelled");
          return;
        }
        await writeFile(filePath, new TextEncoder().encode(json));
        setImportExportMessage(`Exported to ${filePath}`);
      } else {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setImportExportMessage("Backup downloaded");
      }
    } catch (e) {
      setImportExportMessage(e instanceof Error ? e.message : "Backup export failed");
    }
  }, []);
```
Verify ALL storage getter names against desktop storage (createStorage provides them — confirm each exists; `getBackOrderReminders`/`getStockWatches` used by Alerts page already). Check `useCallback` import. Buttons: "Export full backup" (primary style like Export Watchlist) in the same flex row; keep existing buttons untouched.

- [ ] **Step 2: Verify**

Run: `pnpm vitest run tests/desktop-backup.test.ts -t "round-trips"` still passes; wiring test still fails (import pending — Task 3). `pnpm check` clean.

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Settings.tsx
git commit -m "Feat: desktop full backup export. TypeScript: 0 errors."
```

---

### Task 3: Import backup with preview + stamping

**Files:**
- Modify: `desktop/src/pages/Settings.tsx`

- [ ] **Step 1: Add import handler**

Imports: `parseBackup, applyBackup` from `"../../../lib/backup"`. Handler:
```tsx
  const handleImportBackup = useCallback(async () => {
    try {
      let contents: string | null = null;
      if (typeof window !== "undefined" && (window as unknown as { __TAURI__?: unknown }).__TAURI__) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const picked = await open({ filters: [{ name: "JSON", extensions: ["json"] }], multiple: false });
        if (!picked) {
          setImportExportMessage("Import cancelled");
          return;
        }
        const bytes = await readFile(picked as string);
        contents = new TextDecoder().decode(bytes);
      } else {
        contents = await new Promise<string | null>((resolve) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "application/json,.json";
          input.onchange = () => {
            const file = input.files?.[0];
            if (!file) {
              resolve(null);
              return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsText(file);
          };
          input.click();
        });
        if (!contents) {
          setImportExportMessage("Import cancelled");
          return;
        }
      }
      const backup = parseBackup(contents);
      if (!backup) {
        setImportExportMessage("That file is not a valid Product Stock Finder backup.");
        return;
      }
      const [watchlist, alerts, reminders, stockWatches, settings] = await Promise.all([
        storage.getWatchlist(),
        storage.getAlerts(),
        storage.getBackOrderReminders(),
        storage.getStockWatches(),
        storage.getSettings(),
      ]);
      const result = applyBackup(backup, { watchlist, alerts, reminders, stockWatches, settings });
      const summary = [
        `Watchlist: +${result.counts.watchlistAdded} new, ${result.counts.watchlistUpdated} updated`,
        `Alerts: +${result.counts.alertsAdded} new, ${result.counts.alertsUpdated} updated`,
        `Reminders: +${result.counts.remindersAdded} new, ${result.counts.remindersUpdated} updated`,
        `Stock watches: +${result.counts.stockWatchesAdded} new, ${result.counts.stockWatchesUpdated} updated`,
      ].join("\n");
      if (!confirm(`Import Backup?\n\n${summary}`)) return;
      await storage.saveWatchlist(result.watchlist);
      await storage.saveAlerts(result.alerts);
      await storage.saveBackOrderReminders(result.reminders);
      await storage.saveStockWatches(result.stockWatches);
      if (result.settingsApplied) await storage.saveSettings(result.settings);
      const now = Date.now();
      for (const idc of result.touchedIds.watchlist) await storage.setItemSyncMeta("watchlist", idc, now);
      for (const idc of result.touchedIds.alerts) await storage.setItemSyncMeta("alerts", idc, now);
      for (const idc of result.touchedIds.reminders) await storage.setItemSyncMeta("reminders", idc, now);
      for (const idc of result.touchedIds.stockWatches) await storage.setItemSyncMeta("reminders", idc, now);
      setImportExportMessage("Backup imported. Reloading…");
      window.location.reload();
    } catch (e) {
      setImportExportMessage(e instanceof Error ? e.message : "Backup import failed");
    }
  }, []);
```
Verify EVERY storage function name first (saveWatchlist/saveAlerts/saveBackOrderReminders/saveStockWatches/saveSettings/setItemSyncMeta — lib/storage/index exports them; confirm desktop `storage` object exposes each). Summary copy mirrors mobile `mergeSummary` verbatim. Add "Import backup" button beside the export one (`aria-label="Import backup"`).
Guard test asserts "Import backup" — ensure the visible button label contains exactly that string.

- [ ] **Step 2: Verify**

Run: full guard file (all pass) + `pnpm check` (clean).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Settings.tsx
git commit -m "Feat: desktop full backup import with preview. TypeScript: 0 errors."
```

---

### Task 4: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in Settings.tsx), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0 — validates Tauri plugin imports bundle; browser fallbacks are runtime branches).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
