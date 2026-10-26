#!/usr/bin/env python3
"""Return 0 when the simulator screenshot is the OmniShop UI, not the home/launch screen."""
import sys

from PIL import Image

image = Image.open(sys.argv[1]).convert("RGB")
width, height = image.size


def fractions(box):
    pixels = list(image.crop(box).getdata())
    total = len(pixels)
    non_white = sum(1 for r, g, b in pixels if not (r > 240 and g > 240 and b > 240)) / total
    background = sum(
        1
        for r, g, b in pixels
        if abs(r - 248) < 8 and abs(g - 250) < 8 and abs(b - 252) < 8
    ) / total
    return non_white, background


top = fractions((0, int(height * 0.18), width, int(height * 0.35)))
middle = fractions((0, int(height * 0.35), width, int(height * 0.80)))
bottom = fractions((0, int(height * 0.88), width, int(height * 0.97)))

# App: light middle surface, some header content, and a non-white nav bar.
# Blank launch: no header/nav content. Home screen: colorful middle.
rendered = middle[1] > 0.8 and top[0] > 0.01 and bottom[0] > 0.5
print(f"top={top} middle={middle} bottom={bottom} rendered={rendered}")
raise SystemExit(0 if rendered else 1)
