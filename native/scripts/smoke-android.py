#!/usr/bin/env python3
"""Exercise the native preview's local purchase workflow on an explicit emulator."""
import argparse
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET

PACKAGE = "com.app.stocktrackerpro.nativepreview"
ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--serial", required=True)
    parser.add_argument("--reset", action="store_true", help="Clear only the native preview's app data")
    parser.add_argument("--evidence", type=Path, default=Path("/tmp/opencode/omnishop-native-evidence"))
    args = parser.parse_args()
    args.evidence.mkdir(parents=True, exist_ok=True)

    def adb(*command, binary=False):
        return subprocess.run(["adb", "-s", args.serial, *command], check=True, capture_output=True,
                              text=not binary, timeout=30).stdout

    def tree():
        adb("shell", "uiautomator", "dump", "/sdcard/omnishop-native-ui.xml")
        try:
            return ET.fromstring(adb("exec-out", "cat", "/sdcard/omnishop-native-ui.xml"))
        except ET.ParseError:
            return ET.Element("not-ready")

    def find(text, contains=False):
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            for node in tree().iter("node"):
                value = node.get("text", "")
                if (text in value if contains else text == value):
                    return node
            time.sleep(0.3)
        raise AssertionError(f"Visible text not found: {text}")

    def tap(text, contains=False):
        node = find(text, contains)
        x1, y1, x2, y2 = map(int, re.findall(r"\d+", node.attrib["bounds"]))
        adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))

    def type_into(label, value, replace=False):
        reveal(label)
        tap(label)
        if replace:
            adb("shell", "input", "keyevent", "KEYCODE_MOVE_END")
            adb("shell", "input", "keyevent", "KEYCODE_DEL")
        adb("shell", "input", "text", value.replace(" ", "%s"))
        adb("shell", "input", "keyevent", "KEYCODE_BACK")

    width, height = map(int, re.search(r"(\d+)x(\d+)", adb("shell", "wm", "size")).groups())

    def scroll(down=True):
        start, end = (0.8, 0.3) if down else (0.3, 0.8)
        x = int(width * 0.96)
        adb("shell", "input", "swipe", str(x), str(int(height * start)),
            str(x), str(int(height * end)), "400")

    def reveal(text, contains=False):
        for _ in range(7):
            for node in tree().iter("node"):
                value = node.get("text", "")
                if (text in value if contains else text == value):
                    return
            scroll()
        raise AssertionError(f"Could not scroll to: {text}")

    def shot(name):
        (args.evidence / f"{name}.png").write_bytes(adb("exec-out", "screencap", "-p", binary=True))

    def launch():
        adb("shell", "am", "start", "-W", "-n", f"{PACKAGE}/com.omnishop.android.MainActivity")

    adb("install", "-r", str(ROOT / "androidApp/build/outputs/apk/debug/androidApp-debug.apk"))
    if args.reset:
        adb("shell", "pm", "clear", PACKAGE)
    launch()
    tap("Saved")
    find("Save your first product. Nothing is pre-added.")
    shot("01-empty")
    type_into("Product title", "QA Tablet")
    type_into("Product link (optional)", "https://example.com/tablet")
    tap("Save")
    find("QA Tablet")
    shot("02-saved")
    scroll()
    for merchant, price, shipping in [("Seller A", "8000.10", ""), ("Seller B", "7999.99", "50.00")]:
        tap("Add comparable offer")
        type_into("Merchant / seller", merchant)
        type_into("Item price (THB)", price)
        if shipping:
            type_into("Shipping (THB, blank = unknown)", shipping)
        tap("Save")
        scroll()
    find("Taxes / payment fees unknown; no delivered-price winner claimed")
    shot("02b-comparison")
    tap("Create purchase record")
    type_into("Merchant / seller", "QA Shop")
    type_into("Quantity", "2", replace=True)
    tap("Save")
    find("QA Shop")
    shot("03-order")
    type_into("Address", "123 Secret Road")
    tap("Save address")
    find("123 Secret Road")
    shot("03b-address")
    type_into("Tracking number", "QA001")
    type_into("Carrier label", "Manual carrier")
    scroll()
    type_into("Quantity", "1", replace=True)
    scroll()
    reveal("Add package")
    tap("Add package")
    scroll()
    type_into("Event description", "First package received")
    scroll()
    reveal("Delivered")
    tap("Delivered")
    scroll(False)
    scroll(False)
    find("Delivery progress: Partially delivered")
    shot("04-partial-delivery")
    tap("Manage returns & refunds")
    tap("Record return request")
    type_into("Return reason", "Damaged screen")
    tap("Save")
    reveal("Update return")
    tap("Update return")
    tap("Requested")
    tap("Partially refunded")
    type_into("Refund amount (THB)", "150.25")
    type_into("Return tracking number (optional)", "RETURN-QA001")
    type_into("Return / refund notes (optional)", "Balance pending")
    tap("Save")
    reveal("Recorded refund: 150.25 THB")
    find("Partially refunded")
    shot("04b-return-refund")
    adb("shell", "am", "force-stop", PACKAGE)
    launch()
    tap("Orders")
    tap("QA Shop", contains=True)
    find("Delivery progress: Partially delivered")
    find("123 Secret Road")
    shot("05-restart-persistence")
    tap("Manage returns & refunds")
    reveal("Recorded refund: 150.25 THB")
    find("RETURN-QA001")
    shot("05b-refund-restart")
    tap("Profile")
    tap("ไทย")
    find("โปรไฟล์")
    shot("06-thai")
    adb("shell", "am", "force-stop", PACKAGE)
    launch()
    tap("คำสั่งซื้อ")
    tap("QA Shop", contains=True)
    find("ความคืบหน้าการจัดส่ง: จัดส่งบางส่วนแล้ว")
    shot("07-thai-restart")
    tap("จัดการการคืนสินค้าและคืนเงิน")
    reveal("เงินคืนที่บันทึกไว้: 150.25 THB")
    find("คืนเงินบางส่วนแล้ว")
    shot("07b-thai-refund-restart")
    adb("shell", "am", "force-stop", PACKAGE)
    print(f"Native shopping, split delivery, return/refund, restart and Thai persistence passed. Evidence: {args.evidence}")


if __name__ == "__main__":
    main()
