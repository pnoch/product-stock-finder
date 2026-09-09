# Desktop Full Backup — Design

Date: 2026-09-06. Scope: full backup export/import on desktop
(approved).

## Problem

Desktop Export/Import is watchlist-only JSON via Tauri commands. A
desktop reinstall/migration loses alerts, reminders, stock watches,
and settings. Mobile has full backup (`lib/backup.ts`:
build/parse/apply with merge-by-id + counts) — pure TS, reusable.

## Approach

TS-side reuse of `lib/backup.ts` (verified types-only imports).
Tauri dialog+fs plugins for files (pattern exists in
`desktop/src/import-export.ts`), Blob/file-input fallback in pure
browser. No Rust changes; one backup format; existing
watchlist-only export untouched.

## Export

- `desktop/src/pages/Settings.tsx` Data Management: "Export full
  backup" button — gather watchlist/alerts/reminders/stock-watches/
  settings via desktop `storage` (= `createStorage`, full API),
  `buildBackup(...)`, save `product-stock-finder-backup-{date}.json`
  (Tauri save dialog + `plugin-fs` write; Blob download fallback).
  Success/error toasts (existing toast pattern).

## Import

- "Import backup" button — pick file (Tauri open dialog + `plugin-fs`
  read; `<input type="file">` fallback), `parseBackup` (invalid →
  error message, same copy as mobile: not-a-valid-backup).
- Preview confirm via native `confirm()` with the merge-summary
  counts (matches the file's existing sign-out confirm precedent
  at line 371; no custom modal).
- On confirm: save all lists + settings (verify each saver name
  against desktop storage first), `setItemSyncMeta` per touched id
  with mobile's collection mapping (stock-watches → reminders),
  success toast, `window.location.reload()` (matches clear-all
  flow).

## Testing

- Round-trip unit test (build → parse → apply with merge counts)
  reusing `lib/backup.ts` through desktop storage getters where
  practical; source guards (buttons, format, sync-meta stamping).
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- CSV changes, Rust changes, auto-backup scheduling, mobile
  changes. Browser-fallback paths verified by code review (no
  headless file-dialog harness).
