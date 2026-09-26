/**
 * Opens a URL outside the app window.
 *
 * The Tauri webview has no host-side opener configured, so `window.open` and
 * `target="_blank"` links never reach the browser — which is why the OAuth flow
 * already shells out to Rust. Routing links through the Rust `open_external`
 * command (http/https/mailto only) fixes "View at distributor", share links and
 * the legal links in the packaged app, while a plain browser keeps using
 * `window.open`.
 */
export async function openExternal(url: string): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_external", { url });
    return;
  } catch {
    // Not running under Tauri (browser dev/preview) — fall through.
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Click handler for an anchor that must open outside the app window. Keeps the
 * `href` for copy/accessibility while preventing an in-place navigation that
 * the webview cannot complete.
 */
export function externalLinkHandler(url: string) {
  return (event: { preventDefault: () => void }) => {
    event.preventDefault();
    void openExternal(url);
  };
}
