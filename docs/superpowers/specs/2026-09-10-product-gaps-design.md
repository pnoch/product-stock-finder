# Product Gaps Bundle — Design Spec (2026-09-10)

Four verified mobile-parity gaps. Mirror copy and behavior; desktop rendering idioms; no new state where existing state serves.

## §A — Overdue visibility + calendar details

Reminder rows compute `isPast` (date < start of today) → amber "Past Due" pill + warning border/date (verbatim mobile). Drop-day cells toggle a selected-day detail panel (product, from→to, %; re-click deselects). Tests: pill + styling; select/deselect + contents.

## §B — Tappable summary + row sparklines

Summary counts toggle the existing status filter (`all ↔ key`) with selected highlight. Rows with ≥2 points render `PriceSparkline` opening the history modal (same trigger as the chart icon). Tests: filter toggles; sparkline opens modal.

## Non-goals

- New filters; calendar redesign; mobile changes.
