# Concierge onboarding

## Sub-features

- Step 1: "What are you hunting for?" — catalog multi-select (max 5), Skip.
- Step 2: "Where do you ship?" — country picker + tax-exempt.
- Step 3: "Notify me when…" — price drops / back in stock / weekly digest toggles.
- Done screen: summary, then lands on Home with data.

## How to get to it (user POV)

First launch only (gated by `has_seen_onboarding`). Clear app data to see it
again: `adb shell pm clear com.app.stocktrackerpro`.

## Driving it with drive.sh

```bash
D=.claude/skills/verify/scripts/drive.sh
adb -s emulator-5554 shell pm clear com.app.stocktrackerpro
$D launch
$D tap 720 1661            # Allow notifications
$D shot onboarding-step1
$D tap 1299 250            # Skip
$D shot home-after-onboarding
```

## Observable end state

- Step 1 shows catalog products with selectable rows and a "N of 5 selected" count.
- Skip jumps straight to Home; no partial watchlist is written.
- Finishing lands on Home with the selected products in the watchlist.

## Gotchas

- The notification permission dialog appears over Step 1 on first launch; tap
  Allow first (physical ~720,1661) or it blocks the step.
- Existing users never see onboarding; clear app data to re-test.
