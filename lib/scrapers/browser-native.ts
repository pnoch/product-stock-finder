//
// Android/iOS replacement for the Playwright-backed browser.ts, selected by
// scripts/metro-resolver.js. Rendering is done by the hidden WebView host
// (components/webview-fetch-host.tsx); this module only adapts the fetch call
// to the same surface resilient.ts expects.
import { BrowserUnavailableError } from "./resilient";
import { requireWebViewHost, WEBVIEW_UNAVAILABLE_MESSAGE } from "./webview-host";

export const browserPool = {
  async acquire(): Promise<never> {
    throw new BrowserUnavailableError(WEBVIEW_UNAVAILABLE_MESSAGE);
  },
  release(_browser: unknown): void {
    throw new BrowserUnavailableError(WEBVIEW_UNAVAILABLE_MESSAGE);
  },
  async shutdown(): Promise<void> {
    throw new BrowserUnavailableError(WEBVIEW_UNAVAILABLE_MESSAGE);
  },
};

export async function fetchWithBrowser(
  url: string,
  options?: { waitForSelector?: string; timeoutMs?: number },
): Promise<string> {
  return requireWebViewHost().load(url, options);
}

export async function teardownBrowserSession(
  _page: { close(): Promise<void> } | undefined,
  _context: { close(): Promise<void> } | undefined,
  release: () => void,
): Promise<void> {
  // The WebView host owns its own lifecycle; nothing native to tear down.
  release();
}
