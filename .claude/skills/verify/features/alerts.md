# Alerts + reminders

## Sub-features

- Alerts tab: price alerts + price-drop history with re-arm.
- Reminders tab: date reminders + back-in-stock watches with reschedule.
- Triggered alerts show inline re-arm.

## How to get to it (user POV)

Bottom tab **Alerts**; switch between Alerts and Reminders sub-tabs.

## Driving it with drive.sh

```bash
D=.claude/skills/verify/scripts/drive.sh
$D tap 1300 2956           # Alerts tab
$D shot alerts-list
```

## Observable end state

- Alerts list shows active alerts with target price and currency.
- Reminders list shows date reminders and stock watches.
- A triggered alert offers re-arm.

## Gotchas

- The Alerts tab shows a badge count when alerts have fired.
