import { describe, expect, it, vi } from "vitest";

const enable = vi.fn(async () => {});
const disable = vi.fn(async () => {});
vi.mock("@/lib/background-service", () => ({
  enableBackgroundService: () => enable(),
  disableBackgroundService: () => disable(),
}));

const isOverlayGranted = vi.fn(async () => false);
const requestOverlay = vi.fn(async () => {});
vi.mock("@/modules/psf-webview-renderer", () => ({
  isOverlayGranted: () => isOverlayGranted(),
  requestOverlay: () => requestOverlay(),
}));

import { applyBackgroundServiceToggle } from "@/lib/background-service-toggle";

describe("applyBackgroundServiceToggle", () => {
  it("enables when on and disables when off", async () => {
    await applyBackgroundServiceToggle(true);
    expect(enable).toHaveBeenCalledTimes(1);
    await applyBackgroundServiceToggle(false);
    expect(disable).toHaveBeenCalledTimes(1);
  });

  it("requests the overlay permission when enabling without it", async () => {
    isOverlayGranted.mockResolvedValueOnce(false);
    requestOverlay.mockClear();
    await applyBackgroundServiceToggle(true);
    expect(requestOverlay).toHaveBeenCalledTimes(1);
  });
});
