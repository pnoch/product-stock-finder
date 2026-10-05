import { BrowserUnavailableError } from "./resilient";

export interface WebViewLoadOptions {
  waitForSelector?: string;
  timeoutMs?: number;
}

export interface WebViewHost {
  load(url: string, opts?: WebViewLoadOptions): Promise<string>;
  clearStorage(url: string): Promise<void>;
}

export const STORAGE_CLEARED_SENTINEL = "__psf_storage_cleared__";

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

// Runs in the page to sign out of the origin's DOM storage, then posts a
// sentinel the host resolves on.
export function buildClearStorageJS(): string {
  return `(function(){
  try { localStorage.clear(); sessionStorage.clear(); } catch(e){}
  window.ReactNativeWebView.postMessage(${JSON.stringify(STORAGE_CLEARED_SENTINEL)});
})(); true;`;
}

// Runs in the page after it loads: best-effort dismiss a cookie/consent/age
// overlay (some sites gate their price scripts behind consent), wait (up to
// timeoutMs) for an optional selector, let late XHR prices settle, then post the
// full rendered HTML back. Dismissal is deliberately scoped to known CMP accepts
// plus consent-context elements so it can't click an "Accept"/"Enter" button
// elsewhere on the page.
export function buildInjectedJS(opts: {
  waitForSelector?: string;
  timeoutMs: number;
  settleMs: number;
}): string {
  const sel = JSON.stringify(opts.waitForSelector ?? null);
  return `(function(){
  var sel = ${sel};
  var deadline = Date.now() + ${opts.timeoutMs};
  function isVisible(el){ try { var r = el.getBoundingClientRect(); var s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; } catch(e){ return true; } }
  function dismissOverlays(){
    var clicked = false;
    var known = ['#onetrust-accept-btn-handler','.onetrust-close-btn-handler','#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll','.cky-btn-accept','.cmplz-btn.cmplz-accept','.iubenda-cs-accept-btn','#shopify-pc__banner__btn-accept','button[data-testid="cookie-accept"]','.qc-cmp2-summary-buttons button[mode="primary"]'];
    try {
      for (var i=0;i<known.length;i++){ var el=document.querySelector(known[i]); if (el && isVisible(el)) { el.click(); clicked = true; } }
      var nodes = document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]');
      var ctx = /cookie|consent|gdpr|privacy|age|overlay|modal|banner|popup/i;
      var txt = /(accept|agree|allow|got it|^\\s*ok\\s*$|zustimmen|akzeptieren|aceptar|accepter|accetta|συμφων|přijmout|souhlas|zgadzam|przyjmuj|am 18|i'?m 18|enter)/i;
      for (var j=0;j<nodes.length && j<300;j++){
        var n=nodes[j];
        var label=((n.innerText||n.value||n.getAttribute('aria-label')||'')+'').trim();
        if (!label || !txt.test(label) || !isVisible(n)) continue;
        var p=n, inCtx=false;
        for (var k=0;k<5 && p;k++){ if (ctx.test((p.className||'')+' '+(p.id||''))) { inCtx=true; break; } p=p.parentElement; }
        if (!inCtx) continue;
        n.click(); clicked = true;
      }
    } catch(e){}
    return clicked;
  }
  function done(){ window.ReactNativeWebView.postMessage(document.documentElement.outerHTML); }
  function ready(){ return !sel || !!document.querySelector(sel); }
  var tries = 0;
  function wait(){
    // Fire the dismissal a few times (CMPs can appear after hydration), then stop.
    if (tries < 3) { dismissOverlays(); }
    tries++;
    if (ready()) { setTimeout(done, ${opts.settleMs}); }
    else if (Date.now() < deadline) { setTimeout(wait, 250); }
    else { done(); }
  }
  wait();
})(); true;`;
}
