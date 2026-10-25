import { describe, expect, it, vi, beforeEach } from "vitest";

const launch = vi.fn();
vi.mock("patchright", () => ({
  chromium: { launch: (...a: unknown[]) => launch(...a) },
}));

import { launchBrowser } from "@/lib/scrapers/browser";

describe("launchBrowser", () => {
  beforeEach(() => launch.mockReset());

  it("uses system Chrome when available", async () => {
    const chrome = { isConnected: () => true };
    launch.mockResolvedValueOnce(chrome);
    await expect(launchBrowser()).resolves.toBe(chrome);
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch.mock.calls[0][0]).toMatchObject({
      headless: true,
      channel: "chrome",
    });
  });

  it("falls back to bundled Chromium when system Chrome is absent", async () => {
    const bundled = { isConnected: () => true };
    launch.mockRejectedValueOnce(new Error("channel chrome not found"));
    launch.mockResolvedValueOnce(bundled);
    await expect(launchBrowser()).resolves.toBe(bundled);
    expect(launch).toHaveBeenCalledTimes(2);
    expect(launch.mock.calls[1][0]).not.toHaveProperty("channel");
  });

  it("launches headed when PSF_BROWSER_HEADED=1", async () => {
    const prev = process.env.PSF_BROWSER_HEADED;
    process.env.PSF_BROWSER_HEADED = "1";
    try {
      const chrome = { isConnected: () => true };
      launch.mockResolvedValueOnce(chrome);
      await expect(launchBrowser()).resolves.toBe(chrome);
      expect(launch.mock.calls[0][0]).toMatchObject({
        headless: false,
        channel: "chrome",
      });
    } finally {
      if (prev === undefined) delete process.env.PSF_BROWSER_HEADED;
      else process.env.PSF_BROWSER_HEADED = prev;
    }
  });

  it("falls back to headless when headed mode has no X display", async () => {
    const prev = process.env.PSF_BROWSER_HEADED;
    process.env.PSF_BROWSER_HEADED = "1";
    try {
      const bundled = { isConnected: () => true };
      launch
        .mockRejectedValueOnce(new Error("Missing X server or $DISPLAY"))
        .mockRejectedValueOnce(new Error("Missing X server or $DISPLAY"))
        .mockResolvedValueOnce(bundled);
      await expect(launchBrowser()).resolves.toBe(bundled);
      expect(launch).toHaveBeenCalledTimes(3);
      expect(launch.mock.calls[2][0]).toMatchObject({ headless: true });
    } finally {
      if (prev === undefined) delete process.env.PSF_BROWSER_HEADED;
      else process.env.PSF_BROWSER_HEADED = prev;
    }
  });

  it("does not mask non-display headed launch errors", async () => {
    const prev = process.env.PSF_BROWSER_HEADED;
    process.env.PSF_BROWSER_HEADED = "1";
    try {
      launch
        .mockRejectedValueOnce(new Error("chrome exploded"))
        .mockRejectedValueOnce(new Error("chromium exploded"));
      await expect(launchBrowser()).rejects.toThrow("chromium exploded");
      expect(launch).toHaveBeenCalledTimes(2);
    } finally {
      if (prev === undefined) delete process.env.PSF_BROWSER_HEADED;
      else process.env.PSF_BROWSER_HEADED = prev;
    }
  });

  it("stays headless when PSF_BROWSER_HEADED is unset", async () => {
    const prev = process.env.PSF_BROWSER_HEADED;
    delete process.env.PSF_BROWSER_HEADED;
    try {
      const chrome = { isConnected: () => true };
      launch.mockResolvedValueOnce(chrome);
      await launchBrowser();
      expect(launch.mock.calls[0][0]).toMatchObject({ headless: true });
    } finally {
      if (prev !== undefined) process.env.PSF_BROWSER_HEADED = prev;
    }
  });
});
