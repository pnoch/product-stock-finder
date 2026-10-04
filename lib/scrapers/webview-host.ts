import { BrowserUnavailableError } from "./resilient";

export interface WebViewLoadOptions {
  waitForSelector?: string;
  timeoutMs?: number;
}

export interface WebViewHost {
  load(url: string, opts?: WebViewLoadOptions): Promise<string>;
}

export const WEBVIEW_UNAVAILABLE_MESSAGE =
  "on-device webview renderer unavailable";

let host: WebViewHost | null = null;

export function setWebViewHost(next: WebViewHost | null): void {
  host = next;
}

export function getWebViewHost(): WebViewHost | null {
  return host;
}

export function requireWebViewHost(): WebViewHost {
  if (!host) throw new BrowserUnavailableError(WEBVIEW_UNAVAILABLE_MESSAGE);
  return host;
}

// Runs in the page after it loads: wait (up to timeoutMs) for an optional
// selector, let late XHR prices settle, then post the full rendered HTML back.
export function buildInjectedJS(opts: {
  waitForSelector?: string;
  timeoutMs: number;
  settleMs: number;
}): string {
  const sel = JSON.stringify(opts.waitForSelector ?? null);
  return `(function(){
  var sel = ${sel};
  var deadline = Date.now() + ${opts.timeoutMs};
  function done(){ window.ReactNativeWebView.postMessage(document.documentElement.outerHTML); }
  function ready(){ return !sel || !!document.querySelector(sel); }
  function wait(){
    if (ready()) { setTimeout(done, ${opts.settleMs}); }
    else if (Date.now() < deadline) { setTimeout(wait, 250); }
    else { done(); }
  }
  wait();
})(); true;`;
}
