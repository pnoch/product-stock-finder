---
name: verify
description: Drive the Product Stock Finder Android app in a running emulator to prove user-facing behavior. Use when a change touches mobile UI, search, watchlist, alerts, or marketplace flows and you need real-device evidence, not just unit tests.
---

# Verify Product Stock Finder (Android emulator)

Proves user-facing behavior by driving the installed app on an Android emulator
and capturing screenshots. Unit tests cover logic; this covers the real app.

## Launch

The app is an Expo/React Native release build. Server-backed features (eBay
search, sync, push) need the local API server and `adb reverse`.

```bash
# 1. API server (headed browser so eBay search works; xvfb for the display)
PSF_BROWSER_HEADED=1 setsid xvfb-run -a pnpm dev:server > /tmp/opencode/api.log 2>&1 < /dev/null & disown
sleep 10 && curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/trpc/trending.get

# 2. Emulator must be running; wire it to the host
adb -s emulator-5554 reverse tcp:3000 tcp:3000
adb -s emulator-5554 reverse tcp:8081 tcp:8081

# 3. Install + launch (release APK; x86_64 build for the emulator)
.claude/skills/verify/scripts/drive.sh launch
```

Ready when `drive.sh shot 00-launch` shows the Home screen ("Good morning" /
"Good evening" + bottom tabs). First launch shows a notification permission
dialog and the 3-step concierge onboarding; tap **Allow**, then **Skip**.

**Release builds ignore a loopback API URL** (`constants/oauth.ts`): with
`EXPO_PUBLIC_API_BASE_URL=http://localhost:3000` a release build runs "Local
mode" and all server features are off. To exercise server features, either
build with a non-loopback URL or use a debug build. The emulator APK must
include the `x86_64` ABI:

```bash
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=x86_64
```

## Doctor

```bash
.claude/skills/verify/scripts/drive.sh doctor
```

Expect: device attached, app installed, `reverse 3000: ok`, `api: 200`. If
`reverse 3000` is missing or `api` is down, server-backed screens will look
broken for the wrong reason.

## Drive

`drive.sh` wraps `adb`. Coordinates are **physical pixels** (the emulator here
is 1440x3120; screenshots are scaled, so multiply screenshot coords by
`physical/screenshot-width`).

```bash
D=.claude/skills/verify/scripts/drive.sh
$D tap 430 2956          # bottom tab (Home/Discover/Watch/Drops/Alerts)
$D text "dgx spark"      # type into the focused field
$D key 111               # ESC / dismiss keyboard
$D swipe 720 2400 720 700 400
$D shot 07-dgx-search
$D ui                    # accessibility tree when a tap misses
```

Prefer stable handles from `$D ui` (accessibility labels like "Search Facebook
Marketplace", "Track eBay listing …", "Retry eBay search") over fixed
coordinates. Bottom tabs sit at y≈2956: Home 130, Discover 430, Watch 720,
Drops 1010, Alerts 1300.

## Evidence

Screenshots go to `$PSF_EVIDENCE` (default `/tmp/opencode/psf-evidence`). A
proof is: the action (a tap/text) plus the resulting screen, plus the side
effect (the product appears in Watch, the price history gains a point). Capture
both the before and after. Do not claim a flow works from a single final
screenshot.

For server-backed flows, confirm the server actually served the request (the
eBay section shows listings, not "Could not search eBay"), because a release
build in Local mode silently skips the network.

## Cleanup

```bash
$D stop                                    # force-stop the app
pkill -f "tsx watch" 2>/dev/null           # stop the API server you started
```

Never kill by process name broadly; kill only what this run started. Evidence
in `$PSF_EVIDENCE` survives cleanup.

## Helpers

- `scripts/drive.sh` — the adb wrapper above. Run it with no args for usage.
