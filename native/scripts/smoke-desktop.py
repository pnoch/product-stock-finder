#!/usr/bin/env python3
"""Linux development smoke: launch the packaged JVM app in a temporary data directory.

Run under xvfb-run; requires xwininfo and Python Pillow with XCB support.
"""
import os
from pathlib import Path
import subprocess
import tempfile
import time

from PIL import ImageGrab


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = Path("/tmp/opencode/omnishop-native-evidence")


def main():
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    executable = ROOT / "desktopApp/build/compose/binaries/main/app/OmniShop/bin/OmniShop"
    with tempfile.TemporaryDirectory(prefix="omnishop-desktop-smoke-") as home:
        with (EVIDENCE / "desktop.log").open("w") as log:
            process = subprocess.Popen([str(executable)], env={**os.environ, "XDG_DATA_HOME": home},
                                       stdout=log, stderr=subprocess.STDOUT)
            try:
                deadline = time.monotonic() + 30
                while time.monotonic() < deadline:
                    if process.poll() is not None:
                        raise AssertionError(f"Desktop app exited with {process.returncode}; see {EVIDENCE / 'desktop.log'}")
                    window = subprocess.run(["xwininfo", "-name", "OmniShop Native Preview"], capture_output=True)
                    if window.returncode == 0:
                        time.sleep(1)
                        ImageGrab.grab().save(EVIDENCE / "08-desktop-start.png")
                        database = Path(home) / "omnishop-native/omnishop.db"
                        assert database.is_file(), "Desktop app did not create its local SQLite database"
                        print(f"Packaged desktop app opened with isolated local SQLite. Evidence: {EVIDENCE}")
                        return
                    time.sleep(0.25)
                raise AssertionError("Desktop window did not appear within 30 seconds")
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=10)


if __name__ == "__main__":
    main()
