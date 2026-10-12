const RENDER_TIMEOUT_MS = 20_000;

// Thin bounded wrapper over the shared scraper browser module (browser pool +
// patchright launch live there, including the PSF_BROWSER_HEADED gate — no
// launch code is duplicated here). Patchright is lazy-imported so merely
// importing this module never loads it.
export async function renderWithBrowser(url: string): Promise<string> {
  const { fetchWithBrowser } = await import("../lib/scrapers/browser");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetchWithBrowser(url, { timeoutMs: RENDER_TIMEOUT_MS }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("browser render timed out")),
          RENDER_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}