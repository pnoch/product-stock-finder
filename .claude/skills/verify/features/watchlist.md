# Watchlist

## Sub-features

- Product rows with best price, stock badge, and distributor.
- Swipe actions: alert / acquired / remove.
- Filters (collapsed behind a "Filters" toggle) + sort + group.
- Acquired products dimmed; "Show acquired" filter.
- Bulk selection.

## How to get to it (user POV)

Bottom tab **Watch**. Seeded products (MikroTik CRS804/CRS326, etc.) appear on
first launch.

## Driving it with drive.sh

```bash
D=.claude/skills/verify/scripts/drive.sh
$D tap 720 2956            # Watch tab
$D shot watch-list
$D swipe 1200 900 300 900 300   # swipe a row left to reveal actions
$D shot watch-swipe
```

## Observable end state

- Rows render with a price and a stock badge.
- A left swipe reveals alert / acquired / remove actions.
- Marking acquired dims the row; "Show acquired" reveals it again.
- The filter toggle shows an active count when a filter is on.

## Gotchas

- Swipe coordinates depend on the row position; read `$D ui` for the row bounds.
