import { describe, expect, it, vi, beforeEach } from "vitest";

const load = vi.fn(async () => "<html>react</html>");
let hostPresent = true;
vi.mock("@/lib/scrapers/webview-host", async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return {
    ...actual,
    getWebViewHost: () => (hostPresent ? { load, clearStorage: async () => {} } : null),
  };
});

const renderOverlay = vi.fn(async () => "<html>overlay</html>");
vi.mock("@/modules/psf-webview-renderer", () => ({
  renderOverlay: (...a: unknown[]) => renderOverlay(...(a as [])),
}));

import { fetchWithBrowser } from "@/lib/scrapers/browser-native";
import { BrowserUnavailableError } from "@/lib/scrapers/resilient";

describe("browser-native hybrid dispatch", () => {
  beforeEach(() => {
    load.mockClear();
    renderOverlay.mockClear();
    hostPresent = true;
  });

  it("uses the React host when present (foreground)", async () => {
    await expect(fetchWithBrowser("https://x.test")).resolves.toBe("<html>react</html>");
    expect(load).toHaveBeenCalledTimes(1);
    expect(renderOverlay).not.toHaveBeenCalled();
  });

  it("uses the overlay renderer when the host is absent (background)", async () => {
    hostPresent = false;
    await expect(fetchWithBrowser("https://x.test")).resolves.toBe("<html>overlay</html>");
    expect(renderOverlay).toHaveBeenCalledTimes(1);
  });

  it("throws BrowserUnavailableError when the overlay renderer fails", async () => {
    hostPresent = false;
    renderOverlay.mockRejectedValueOnce(new Error("overlay not permitted"));
    await expect(fetchWithBrowser("https://x.test")).rejects.toBeInstanceOf(
      BrowserUnavailableError,
    );
  });
});
