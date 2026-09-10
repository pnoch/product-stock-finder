# Desktop Product Notes + Edit — Design

Date: 2026-09-06. Scope: notes card and edit sheet on desktop
detail (approved; first of product-detail split).

## Problem

1. No per-product notes on desktop (mobile has the helpers but
   the card is unwired everywhere — building fresh on desktop).
2. Manual/bulk-import typos unfixable on desktop (mobile edits
   via `updateProductDetails`).

## Approach

Mirror mobile logic with desktop UI. No server changes.

## Notes card

- `desktop/src/pages/ProductDetail.tsx`: "My Note" card —
  view (note text or muted "No note yet") + Edit toggle;
  editing shows textarea + Save/Cancel.
- Persistence via `getProductNote`/`saveProductNote`
  (`lib/product-notes.ts`) with an injected localStorage-backed
  store (same pattern as onboarding tour). Empty save deletes
  the key (helper behavior, unchanged).

## Edit product sheet

- Header Edit button opens a modal sheet (shared desktop `Modal`
  component — verify) with name/model/brand/category/
  description fields prefilled from product.
- Save enabled only when changed vs product (dirty check mirrors
  mobile `canSave`); calls `storage.updateProductDetails(id,
  draft)` (full `createStorage` API present on desktop —
  verified), then reloads product state + toast. Failures show
  inline error, sheet stays open.

## Testing

- Source-guard tests: notes card + store wiring, edit sheet +
  update call.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Cross-device notes sync (local-only, same as mobile),
  listing/image editing, mobile changes.
