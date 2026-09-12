# Discovery + Compare — Design Spec (2026-09-10)

Two verified gaps. Mobile's URL path is UX affordance over the same parse endpoint (both call `fetchParsedProduct`) — desktop mirrors that shape over its `discoverProduct` path. Cheapest-region is a pure shared util.

## §A — Manual modal upgrades

URL field + "Fetch from URL" (enabled only for `/^https?:\/\/\S+/i`, feeds the same parse path); description textarea carried into the product; "Already Tracked" guard via `customProductSlug` vs `trackedIds` with verbatim mobile copy. Tests: gating, description, duplicate block.

## §B — Cheapest-by-region card

Per-region rows (flag + distributor + converted price), overall-cheapest highlight (static, no pulse animation — desktop has no entrance animations), "No in-stock regions" empty state. Pure `cheapestByRegion`. Tests: rows, empty, highlight.

## Non-goals

- New parse endpoints; discovery changes; card animations; mobile changes.
