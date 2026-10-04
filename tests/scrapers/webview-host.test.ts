import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  setWebViewHost,
  getWebViewHost,
  requireWebViewHost,
  buildInjectedJS,
} from "@/lib/scrapers/webview-host";
import { BrowserUnavailableError } from "@/lib/scrapers/resilient";

describe("webview-host registry", () => {
  beforeEach(() => setWebViewHost(null));

  it("has no host by default and requireWebViewHost throws", () => {
    expect(getWebViewHost()).toBeNull();
    expect(() => requireWebViewHost()).toThrow(BrowserUnavailableError);
  });

  it("returns the registered host", async () => {
    const load = vi.fn(async () => "<html></html>");
    setWebViewHost({ load });
    expect(getWebViewHost()).toBe(requireWebViewHost());
    await expect(requireWebViewHost().load("https://x")).resolves.toBe(
      "<html></html>",
    );
  });
});

describe("buildInjectedJS", () => {
  it("posts the rendered HTML back to React Native", () => {
    const js = buildInjectedJS({ timeoutMs: 20000, settleMs: 500 });
    expect(js).toContain("window.ReactNativeWebView.postMessage");
    expect(js).toContain("document.documentElement.outerHTML");
  });

  it("encodes the optional waitForSelector", () => {
    const js = buildInjectedJS({
      waitForSelector: ".price",
      timeoutMs: 20000,
      settleMs: 500,
    });
    expect(js).toContain('".price"');
    expect(buildInjectedJS({ timeoutMs: 1, settleMs: 0 })).toContain("null");
  });
});
