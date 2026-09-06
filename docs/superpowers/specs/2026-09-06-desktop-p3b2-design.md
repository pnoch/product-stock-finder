# Desktop P3b-2: LLM, Scraper-Status, About Sections — Design

Date: 2026-09-06. Scope: second settings-parity slice — configure and
info sections (approved). Server-account deletion excluded (own spec).

## Problem

Desktop Settings lacks LLM provider configuration (needed for AI
insights/discovery on desktop), distributor scraper status with
re-enable, and app version/install info — all present on mobile.

## Approach

Tailwind ports into `desktop/src/pages/Settings.tsx` reusing mobile
logic and the same `AppSettings` keys (which sync). No new data
layers, no server changes.

## LLM section

- Port `components/settings/llm-settings-section.tsx` (provider
  select: Forge/OpenAI/Ollama Cloud/Ollama Local; API key with
  show/hide; model + Ollama URL inputs; Save): same keys
  (`llmProvider`, `llmApiKey`, `llmModel`, `llmOllamaUrl`) via desktop
  `storage.getSettings`/`saveSettings`, success toast on save.
- API key input `type="password"` with show/hide toggle (parity).

## Scraper section

- Per-distributor rows (OK/Stale/Failed derived from last
  success/error in price history, same thresholds as mobile) with
  Re-enable button per failed/stale distributor.
- Re-enable mirrors mobile `handleReenableDistributor`
  (`app/(tabs)/settings.tsx:205`): stamp `lastChecked: nowIso` on
  matching listings via `storage.updateProductListings`, toast result.
- Loads watchlist via `storage.getWatchlist()` on mount for status
  computation.

## About section

- App version read from `desktop/package.json` (JSON import —
  verify `tsc` + vite build accept it; single source with the release
  process, no hardcoded copy).
- PWA install button via `beforeinstallprompt` (same as the mobile
  web path), rate-app/store link, short support/about copy.
- Excludes sign-out (Account has it), local clear (Danger Zone has
  it), and server-account deletion (auth-sensitive — own spec).

## Testing

- Source-guard tests: three sections present with key wirings
  (`llmProvider`, re-enable via `updateProductListings`, package
  version, no `delete-account` reference).
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Server-account deletion, sign-out duplication.
- Sync/status behavior changes; mobile code untouched.
