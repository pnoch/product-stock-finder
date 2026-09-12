# Product Polish Bundle — Design Spec (2026-09-10)

Six verified gaps. Mirror mobile logic and copy; desktop stack; no polling or expo-push entanglement. Import-compatibility questions resolve in planning.

## §A — Best-price signals

Trend badge (▼/▲ % vs oldest, ≥2 points), "Lowest Price Ever" banner (USD-normalized prior-min), one-tap "Set Alert at X (−5%)" creating directly. Tests: all three render + alert created.

## §B — AI manual-add

Two-step paste → server parse → review → live discovery with progress → create; plain-form fallback on parse failure/offline. Existing error taxonomy + 15s timeout reused. Tests: happy path, fallback, auth error.

## §C — Web-notifications toggle

Toggle row (mobile copy/hints) persisting synced `webNotificationsEnabled`; `sendDesktopNotification` falls back to `displayWebNotification` on web when on + permitted. Tests: toggle flows + gated fallback.

## §D — Navigation + header parity

`?tab=` live-sync + addressable notifications tab (unknown → alerts); summary "View statistics" → `/stats`; header converted best + rate line + payment methods. Tests: sync, href, lines.

## Non-goals

- Polling changes; expo-push entanglement; new alert types; mobile changes.
