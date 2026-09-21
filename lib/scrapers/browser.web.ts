import { BrowserUnavailableError } from "./resilient";

export const browserPool = {
  async acquire(): Promise<never> {
    throw new BrowserUnavailableError("browser escalation unavailable on this platform");
  },
  release(_browser: unknown): void {
    throw new BrowserUnavailableError("browser escalation unavailable on this platform");
  },
  async shutdown(): Promise<void> {
    throw new BrowserUnavailableError("browser escalation unavailable on this platform");
  },
};

export async function fetchWithBrowser(
  _url: string,
  _options?: { waitForSelector?: string; timeoutMs?: number },
): Promise<never> {
  throw new BrowserUnavailableError("browser escalation unavailable on this platform");
}

export async function teardownBrowserSession(
  page: { close(): Promise<void> } | undefined,
  context: { close(): Promise<void> } | undefined,
  release: () => void,
): Promise<void> {
  try {
    if (page) await page.close();
  } catch {
    // no-op on web
  }
  try {
    if (context) await context.close();
  } catch {
    // no-op on web
  }
  release();
}
