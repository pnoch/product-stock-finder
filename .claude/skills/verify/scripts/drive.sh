#!/usr/bin/env bash
# Drives the Product Stock Finder Android app in a running emulator.
#
#   drive.sh doctor                 # is the instance worth driving?
#   drive.sh launch                 # install + start the app, wait for Home
#   drive.sh tap <x> <y>            # tap in PHYSICAL pixels
#   drive.sh text <string>          # type into the focused field
#   drive.sh key <keyevent>         # e.g. 111 (ESC), 4 (BACK), 66 (ENTER)
#   drive.sh swipe <x1> <y1> <x2> <y2> [ms]
#   drive.sh shot <name>            # screenshot to evidence dir
#   drive.sh ui                     # dump the accessibility tree (uiautomator)
#   drive.sh stop                   # force-stop the app
#
# Screenshots land in $PSF_EVIDENCE (default /tmp/opencode/psf-evidence).
# Coordinates are PHYSICAL pixels. The emulator reports its size via `wm size`;
# screenshots are scaled, so multiply screenshot coords by (physical/scale).
set -euo pipefail

SERIAL="${PSF_SERIAL:-emulator-5554}"
PKG="com.app.stocktrackerpro"
ACTIVITY="$PKG/.MainActivity"
EVIDENCE="${PSF_EVIDENCE:-/tmp/opencode/psf-evidence}"
APK="${PSF_APK:-android/app/build/outputs/apk/release/app-release.apk}"

adb_() { adb -s "$SERIAL" "$@"; }

cmd_doctor() {
  echo "== doctor =="
  adb devices | grep -q "$SERIAL" || { echo "FAIL: $SERIAL not attached"; exit 1; }
  echo "device: $(adb_ shell getprop ro.build.version.release) (API $(adb_ shell getprop ro.build.version.sdk))"
  echo "size:   $(adb_ shell wm size | tr -d '\r')"
  adb_ shell pm list packages | grep -q "$PKG" && echo "app:    installed" || echo "app:    NOT installed (run launch)"
  adb_ reverse --list | grep -q "tcp:3000" && echo "reverse 3000: ok" || echo "reverse 3000: MISSING (server features will be off)"
  adb_ reverse --list | grep -q "tcp:8081" && echo "reverse 8081: ok" || echo "reverse 8081: missing"
  curl -sS -o /dev/null -w "api:    %{http_code}\n" --max-time 5 http://localhost:3000/api/trpc/trending.get || echo "api:    DOWN"
}

cmd_launch() {
  mkdir -p "$EVIDENCE"
  adb_ reverse tcp:3000 tcp:3000 >/dev/null 2>&1 || true
  adb_ reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true
  [ -f "$APK" ] && adb_ install -r "$APK" >/dev/null
  adb_ shell am start -n "$ACTIVITY" >/dev/null
  sleep 12
  cmd_shot "00-launch"
}

cmd_tap()  { adb_ shell input tap "$1" "$2"; }
cmd_text() { adb_ shell input text "$(printf '%s' "$1" | sed 's/ /%s/g')"; }
cmd_key()  { adb_ shell input keyevent "$1"; }
cmd_swipe(){ adb_ shell input swipe "$1" "$2" "$3" "$4" "${5:-400}"; }

cmd_shot() {
  mkdir -p "$EVIDENCE"
  adb_ exec-out screencap -p > "$EVIDENCE/$1.png"
  echo "$EVIDENCE/$1.png"
}

cmd_ui() { adb_ exec-out uiautomator dump /dev/tty 2>/dev/null | sed 's/></>\n</g'; }

cmd_stop() { adb_ shell am force-stop "$PKG"; echo "stopped $PKG"; }

case "${1:-}" in
  doctor) cmd_doctor ;;
  launch) cmd_launch ;;
  tap)    shift; cmd_tap "$@" ;;
  text)   shift; cmd_text "$@" ;;
  key)    shift; cmd_key "$@" ;;
  swipe)  shift; cmd_swipe "$@" ;;
  shot)   shift; cmd_shot "$@" ;;
  ui)     cmd_ui ;;
  stop)   cmd_stop ;;
  *) sed -n '2,20p' "$0"; exit 1 ;;
esac
