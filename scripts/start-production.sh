#!/usr/bin/env bash
set -euo pipefail

# Headed Chromium needs an X server. `xvfb-run -a` hangs in bookworm-slim, so
# start Xvfb directly and export DISPLAY.
Xvfb :99 -screen 0 1280x720x24 >/tmp/xvfb.log 2>&1 &
XVFB_PID=$!
trap 'kill "$XVFB_PID" 2>/dev/null || true' EXIT

# Wait for the display socket before launching the server.
for _ in $(seq 1 50); do
  [ -S /tmp/.X11-unix/X99 ] && break
  sleep 0.1
done

if [ -S /tmp/.X11-unix/X99 ]; then
  export DISPLAY=:99
  export PSF_BROWSER_HEADED=1
else
  echo "Xvfb did not create :99; starting in headless browser mode" >&2
fi

exec node dist/index.js
