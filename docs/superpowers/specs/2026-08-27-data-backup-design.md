# Data Export/Import — Design Spec

**Date:** 2026-08-27
**Goal:** Let users export their watchlist, alerts, reminders, stock watches, and settings to a versioned JSON backup file, and import such a file back with merge-by-id semantics — from a new "Data" section in Settings.

## Transport

New dependencies: `expo-file-system`, `expo-sharing`, `expo-document-picker`.

- **Export** — native: write JSON to a temp file in cache directory, open share sheet via `expo-sharing`. Web: trigger a Blob download (`product-stock-finder-backup-YYYY-MM-DD.json`).
- **Import** — native: `expo-document-picker` (JSON mime), read file contents. Web: hidden `<input type="file">`, read via FileReader.

## Backup Format (version 1)

```json
{
  "format": "product-stock-finder-backup",
  "version": 1,
  "exportedAt": "2026-08-27T00:00:00.000Z",
  "watchlist": [ /* Product[] incl. listings + priceHistory */ ],
  "alerts": [ /* PriceAlert[] */ ],
  "reminders": [ /* BackOrderReminder[] */ ],
  "stockWatches": [ /* BackOrderReminder[] */ ],
  "settings": { /* AppSettings incl. tagDefinitions */ }
}
```

Excluded (transient/device-local): sync meta, notification history + displayed event ids, FX rate cache, digest snapshot, pending health events.

## Pure Logic (lib/backup.ts)

### `buildBackup(input): string`
Takes `{ watchlist, alerts, reminders, stockWatches, settings }`; returns pretty-printed JSON string with format marker, `version: 1`, `exportedAt`.

### `parseBackup(json: string): BackupData | null`
Validates:
- JSON parses; top-level object.
- `format === "product-stock-finder-backup"`.
- `version` is a number ≤ 1 (reject unknown future versions).
- Each collection coerced to an array if malformed (missing/wrong type → empty array); `settings` must be an object or is dropped (undefined).

Returns structured data or `null` (caller shows failure alert). Never throws.

### `applyBackup(backup, current): MergeResult`
Merge-by-id per collection:
- Union keyed on item `id`; backup copy wins conflicts; device-only items preserved.
- Settings: shallow merge — backup fields overwrite local fields they contain; tagDefinitions merged by tag id the same way.
- Returns counts for the confirmation/success dialog:

```typescript
interface MergeResult {
  watchlistAdded: number;
  watchlistUpdated: number;
  alertsAdded: number;
  alertsUpdated: number;
  remindersAdded: number;
  remindersUpdated: number;
  stockWatchesAdded: number;
  stockWatchesUpdated: number;
  settingsApplied: boolean;
}
```

### Sync-meta stamping
After applying, caller stamps each imported/updated item via `setItemSyncMeta(collection, id, Date.now())` so signed-in users' imports win LWW against server state. Pure module exposes which ids were touched via `applyBackup`'s second return field (`touchedIds: { watchlist: string[], alerts: string[], reminders: string[], stockWatches: string[] }`).

## Platform Transport (lib/backup-files.ts)

- `exportBackupFile(json: string): Promise<boolean>` — native: `FileSystem.writeAsStringAsync` into cache + `Sharing.shareAsync` (mime application/json); web: Blob + anchor download. Returns false if unsupported/unavailable.
- `pickBackupFile(): Promise<string | null>` — native: `DocumentPicker.getDocumentAsync` (type application/json) then `FileSystem.readAsStringAsync`; web: programmatic file input + FileReader text. Returns file contents or null on cancel/failure.

Platform guards follow existing conventions (`Platform.OS === "web"` branches inside functions).

## UI (components/settings/data-section.tsx)

"Data" section in Settings below Device Management:

- **Export Backup** row → builds backup from storage, calls transport, success/failure alert.
- **Import Backup** row → picks file → parse fails → error alert ("Not a valid backup file"); succeeds → confirm dialog summarizing merge counts → apply → stamp sync meta → success alert.

Uses existing patterns: `SectionHeader`, `SettingRow`, `showAlert`, haptics on tap.

## Testing

`tests/backup.test.ts`: build→parse round-trip fidelity; parse rejects wrong format marker / future version / garbage; apply merges by id (add vs update vs preserve); settings shallow merge incl. tagDefinitions; touchedIds correctness. Full suite per task.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/backup.ts` | new (~180 lines) |
| `tests/backup.test.ts` | new |
| `lib/backup-files.ts` | new (~90 lines) |
| `components/settings/data-section.tsx` | new (~150 lines) |
| `app/(tabs)/settings.tsx` | modify (render DataSection) |
| `package.json` | +3 expo packages |
| `todo.md` | append Phase 80 |
