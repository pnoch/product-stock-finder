import { describe, expect, it, vi, beforeEach } from "vitest";

const start = vi.fn(async () => {});
const stop = vi.fn(async () => {});
const isRunning = vi.fn(async () => false);
vi.mock("@/modules/psf-foreground-service", () => ({
  startForegroundService: () => start(),
  stopForegroundService: () => stop(),
  isForegroundServiceRunning: () => isRunning(),
}));

import {
  enableBackgroundService,
  disableBackgroundService,
  isBackgroundServiceEnabled,
} from "@/lib/background-service";

describe("background-service controller", () => {
  beforeEach(() => {
    start.mockClear();
    stop.mockClear();
    isRunning.mockClear();
  });

  it("starts and stops the service", async () => {
    await enableBackgroundService();
    expect(start).toHaveBeenCalledTimes(1);
    await disableBackgroundService();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("reports the running state", async () => {
    isRunning.mockResolvedValueOnce(true);
    expect(await isBackgroundServiceEnabled()).toBe(true);
  });

  it("never throws when the native module fails", async () => {
    start.mockRejectedValueOnce(new Error("no module"));
    await expect(enableBackgroundService()).resolves.toBeUndefined();
  });
});
