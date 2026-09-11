# Small Leftovers — Design Spec (2026-09-10)

Three low items deferred from earlier bundles. No new patterns, no visual redesign, mobile parity where applicable.

## §A — Behavioral wiring test

Replace the white-box `readFile`/`toContain("setHistoryFor")` test in `distributor-history-modal.test.tsx` with a behavioral test: render `ProductDetail` (reuse converted-row/insight-skeleton harness), click `View … price history`, assert the modal opens (distributor name + Download CSV). Fallback only: keep the guard with a reported reason if click-through proves impractical.

## §B — Home connection badge

Render existing `ConnectionBadge` + `useConnection` in the `Home.tsx` header with `App.tsx:65-71` props (signed-out → `/settings`), mirroring mobile's always-visible badge. Test: badge reflects mocked status.

## §C — Responsive Compare chart

`ResizeObserver`-measured width `clamp(measured, 320, 960)`, height 280; hover math already in CSS pixels so it stays exact; `ResizeObserver`-absent fallback 640; remove `overflow-x-auto`. Test: fallback width in jsdom + clamp coverage.

## Non-goals

- Chart redesign; new badge copy; auto-refresh; mobile changes.
