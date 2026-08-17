import { BrowserUnavailableError } from "./resilient";

export const browserPool = {
  async acquire(): Promise<never> {
    throw new BrowserUnavailableError("browser escalation unavailable on web");
  },
  release(_browser: unknown): void {
    throw new BrowserUnavailableError("browser escalation unavailable on web");
  },
  async shutdown(): Promise<void> {
    throw new BrowserUnavailableError("browser escalation unavailable on web");
  },
};

export async function fetchWithBrowser(
  _url: string,
  _options?: { waitForSelector?: string; timeoutMs?: number },
): Promise<never> {
  throw new BrowserUnavailableError("browser escalation unavailable on web");
}
