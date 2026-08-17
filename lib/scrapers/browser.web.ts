import { BrowserUnavailableError } from "./resilient";

export async function fetchWithBrowser(): Promise<string> {
  throw new BrowserUnavailableError("browser escalation unavailable on web");
}