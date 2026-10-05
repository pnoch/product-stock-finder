//
// Android/iOS replacement for the Playwright-backed browser.ts, selected by
// scripts/metro-resolver.js. Rendering is done by the hidden WebView host
// (components/webview-fetch-host.tsx); this module only adapts the fetch call
// to the same surface resilient.ts expects.
import { BrowserUnavailableError } from "./resilient";
import { getBackgroundAppState } from "../background-safe-timers";
import {
  getWebViewHost,
  WEBVIEW_UNAVAILABLE_MESSAGE,
  type WebViewLoadOptions,
} from "./webview-host";

type OverlayRenderer = {
  renderOverlay(url: string, options?: WebViewLoadOptions): Promise<string>;
};

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

// The native overlay renderer is imported lazily so its react-native /
// expo-modules-core dependency never enters the node/web module graph. The
// import is started once, eagerly, at module load; a failure (module absent on
// iOS/web) resolves to null so a background fetch reports
// BrowserUnavailableError and resilient falls through to plain HTTP.
let overlay: OverlayRenderer | null = null;
void import("@/modules/psf-webview-renderer")
  .then((mod) => {
    overlay = mod;
  })
  .catch(() => {
    overlay = null;
  });

export async function fetchWithBrowser(
  url: string,
  options?: WebViewLoadOptions,
): Promise<string> {
  // Dispatch on app state, not host presence: when backgrounded the React tree
  // is still mounted (so the host exists) but its JS bridge is throttled, so we
  // must use the native overlay renderer instead.
  const host = getWebViewHost();
  if (getBackgroundAppState() !== "background" && host) {
    return host.load(url, options);
  }
  // Background (or no host): use the native overlay renderer.
  if (!overlay) throw new BrowserUnavailableError(WEBVIEW_UNAVAILABLE_MESSAGE);
  try {
    return await overlay.renderOverlay(url, options);
  } catch (e) {
    if (e instanceof BrowserUnavailableError) throw e;
    throw new BrowserUnavailableError(
      e instanceof Error ? e.message : WEBVIEW_UNAVAILABLE_MESSAGE,
    );
  }
}

export async function teardownBrowserSession(
  _page: { close(): Promise<void> } | undefined,
  _context: { close(): Promise<void> } | undefined,
  release: () => void,
): Promise<void> {
  // The WebView host owns its own lifecycle; nothing native to tear down.
  release();
}
