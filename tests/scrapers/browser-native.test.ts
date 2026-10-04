import { describe, expect, it, vi, beforeEach } from "vitest";
import * as native from "@/lib/scrapers/browser-native";
import { setWebViewHost } from "@/lib/scrapers/webview-host";
import { BrowserUnavailableError } from "@/lib/scrapers/resilient";

describe("browser-native", () => {
  beforeEach(() => setWebViewHost(null));

  it("throws BrowserUnavailableError when no host is mounted", async () => {
    await expect(native.fetchWithBrowser("https://x")).rejects.toBeInstanceOf(
      BrowserUnavailableError,
    );
  });

  it("delegates to the mounted host with options", async () => {
    const load = vi.fn(async () => "<html>ok</html>");
    setWebViewHost({ load });
    await expect(
      native.fetchWithBrowser("https://x", { waitForSelector: ".p", timeoutMs: 5000 }),
    ).resolves.toBe("<html>ok</html>");
    expect(load).toHaveBeenCalledWith("https://x", {
      waitForSelector: ".p",
      timeoutMs: 5000,
    });
  });

  it("has the same export surface as the node browser module", async () => {
    const real = await import("@/lib/scrapers/browser");
    for (const key of Object.keys(real)) {
      expect(Object.keys(native), `missing ${key}`).toContain(key);
    }
  });

  it("teardown releases", async () => {
    const release = vi.fn();
    await native.teardownBrowserSession(undefined, undefined, release);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
