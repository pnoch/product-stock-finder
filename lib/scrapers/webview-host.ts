import { BrowserUnavailableError } from "./resilient";

export interface WebViewLoadOptions {
  waitForSelector?: string;
  timeoutMs?: number;
}

export interface MarketplaceCardSnapshot {
  itemUrl: string;
  title: string | null;
  priceText: string | null;
  location: string | null;
}

export interface MarketplacePageSnapshot {
  url: string;
  html: string;
  cards: MarketplaceCardSnapshot[];
  scope: { area: string | null; radiusKm: number | null };
  emptyMessage: string | null;
  loginVisible: boolean;
}

export interface WebViewHost {
  load(url: string, opts?: WebViewLoadOptions): Promise<string>;
  clearStorage(url: string): Promise<void>;
  // Additive: distributor callers keep using load(). A snapshot returns the
  // final URL plus structured values observed on the rendered page so
  // marketplace verification does not have to re-parse raw HTML on device.
  snapshot?(
    url: string,
    opts?: WebViewLoadOptions,
  ): Promise<MarketplacePageSnapshot>;
}

export const STORAGE_CLEARED_SENTINEL = "__psf_storage_cleared__";

// The snapshot page script posts this marker immediately before its JSON
// payload. Kept distinct from STORAGE_CLEARED_SENTINEL and from the raw HTML
// that load() posts so the host can route each message unambiguously.
export const SNAPSHOT_MESSAGE_MARKER = "__psf_marketplace_snapshot__";

// Bounds enforced both when the page emits the message and again at the native
// boundary, so a hostile or broken page cannot flood the bridge.
export const MAX_SNAPSHOT_HTML_CHARS = 300_000;
export const MAX_SNAPSHOT_CARDS = 60;

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

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function boundedString(value: unknown, max: number): string | null {
  return typeof value === "string" ? value.slice(0, max) : null;
}

// Native-boundary validation for a snapshot message. Returns null for any
// message that is not a well-formed, bounded snapshot (raw HTML from load(),
// the storage-cleared sentinel, malformed JSON, or an oversized payload), so
// the caller can keep waiting for the real snapshot instead of resolving on a
// stray message.
export function parseSnapshotMessage(
  raw: string,
): MarketplacePageSnapshot | null {
  if (typeof raw !== "string" || !raw.startsWith(SNAPSHOT_MESSAGE_MARKER)) {
    return null;
  }
  const body = raw.slice(SNAPSHOT_MESSAGE_MARKER.length);
  if (body.length > MAX_SNAPSHOT_HTML_CHARS + 200_000) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const payload = asRecord(parsed);
  if (typeof payload.url !== "string" || typeof payload.html !== "string") {
    return null;
  }
  const rawCards = Array.isArray(payload.cards) ? payload.cards : [];
  const cards: MarketplaceCardSnapshot[] = [];
  for (const candidate of rawCards) {
    if (cards.length >= MAX_SNAPSHOT_CARDS) break;
    const rec = asRecord(candidate);
    const itemUrl = boundedString(rec.itemUrl, 2048);
    if (!itemUrl) continue;
    cards.push({
      itemUrl,
      title: boundedString(rec.title, 512),
      priceText: boundedString(rec.priceText, 128),
      location: boundedString(rec.location, 256),
    });
  }
  const scope = asRecord(payload.scope);
  const area = boundedString(scope.area, 200);
  const empty = boundedString(payload.emptyMessage, 300);
  const radius =
    typeof scope.radiusKm === "number" &&
    Number.isFinite(scope.radiusKm) &&
    scope.radiusKm > 0
      ? scope.radiusKm
      : null;
  return {
    url: payload.url.slice(0, 2048),
    html: payload.html.slice(0, MAX_SNAPSHOT_HTML_CHARS),
    cards,
    scope: { area: area && area.trim() !== "" ? area : null, radiusKm: radius },
    emptyMessage: empty && empty.trim() !== "" ? empty : null,
    loginVisible: payload.loginVisible === true,
  };
}

// Runs in the page for a snapshot request. Unlike buildInjectedJS (which posts
// raw HTML for the distributor parsers), this walks the live DOM and posts a
// bounded JSON envelope: final URL, page HTML, and observed structured values.
// Each item link is associated with its smallest result-card container; a
// container holding several distinct item IDs is ambiguous and dropped, so one
// card can never lend its price or location to its neighbour. Price text is
// accepted only when a THB marker is present. Missing fields stay null.
export function buildSnapshotJS(opts: {
  timeoutMs: number;
  settleMs: number;
}): string {
  return String.raw`(function(){
  var MAX_HTML = ${JSON.stringify(MAX_SNAPSHOT_HTML_CHARS)};
  var MAX_CARDS = ${JSON.stringify(MAX_SNAPSHOT_CARDS)};
  var MARKER = ${JSON.stringify(SNAPSHOT_MESSAGE_MARKER)};
  var deadline = Date.now() + ${JSON.stringify(opts.timeoutMs)};
  function itemIdOf(href){
    if (!href) return null;
    var m = /\/marketplace\/item\/([1-9]\d{0,19})(?:\/|$|\?|#)/.exec(href);
    return m ? m[1] : null;
  }
  function clean(v){ return (v || '').replace(/\s+/g, ' ').trim(); }
  function idsWithin(node){
    var out = {}, i, list = node.querySelectorAll ? node.querySelectorAll('a[href*="/marketplace/item/"]') : [];
    for (i = 0; i < list.length; i++){
      var id = itemIdOf(list[i].getAttribute('href') || list[i].href);
      if (id) out[id] = 1;
    }
    return out;
  }
  function pickContainer(link, id){
    var node = link;
    while (node && node.parentElement && node !== document.body){
      var ids = idsWithin(node);
      var keys = Object.keys(ids);
      if (keys.length > 1) return null;
      if (keys.length === 1 && keys[0] === id) return node;
      node = node.parentElement;
    }
    return null;
  }
  function collectCards(){
    var cards = [], seen = {}, links = document.querySelectorAll('a[href*="/marketplace/item/"]'), i;
    for (i = 0; i < links.length && cards.length < MAX_CARDS; i++){
      var link = links[i];
      var href = link.getAttribute('href') || link.href || '';
      var id = itemIdOf(href);
      if (!id || seen[id]) continue;
      var container = pickContainer(link, id);
      if (!container) continue;
      seen[id] = 1;
      var title = clean(link.textContent) || null;
      var containerText = clean(container.textContent);
      var pm = containerText.match(/(?:฿|THB)\s*[\d,]+(?:\.\d{1,2})?/i);
      var priceText = pm ? pm[0] : null;
      var location = null, leaves = container.querySelectorAll('span, div'), j;
      for (j = 0; j < leaves.length && j < 80; j++){
        var el = leaves[j];
        if (el.querySelector && el.querySelector('a[href*="/marketplace/item/"]')) continue;
        var text = clean(el.textContent);
        if (!text || text.length > 60) continue;
        if (/฿|THB|^\d/.test(text)) continue;
        if (title && text === title) continue;
        location = text; break;
      }
      cards.push({
        itemUrl: /^https?:/i.test(href) ? href : ('https://www.facebook.com' + href),
        title: title,
        priceText: priceText,
        location: location
      });
    }
    return cards;
  }
  function isVisible(el){
    try {
      var s = document.defaultView.getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden';
    } catch(e){ return true; }
  }
  var LOGIN_TEXT = /log in|sign in|forgotten password|forgot password|email address or phone number|เข้าสู่ระบบ|ลงชื่อเข้าใช้|ลืมรหัสผ่าน/i;
  var BLOCKING = /you must log in|log in to continue|sign in to continue|เข้าสู่ระบบเพื่อ|ลงชื่อเข้าใช้เพื่อ/i;
  function loginVisible(){
    var pw = document.querySelector('input[type="password"]');
    if (pw && isVisible(pw)) return true;
    var scopes = document.querySelectorAll('[role="dialog"], [aria-modal="true"], form'), i;
    for (i = 0; i < scopes.length && i < 50; i++){
      var el = scopes[i];
      if (!isVisible(el)) continue;
      var text = clean(el.textContent);
      if (BLOCKING.test(text)) return true;
      if (LOGIN_TEXT.test(text) && el.querySelector('input')) return true;
    }
    return false;
  }
  function emptyMessage(){
    var path = '';
    try { path = new URL(location.href).pathname; } catch(e){}
    var searchLike = /\/marketplace\/(search|category)/.test(path);
    if (!searchLike){
      var inputs = document.querySelectorAll('input'), k;
      for (k = 0; k < inputs.length && k < 40; k++){
        var label = (inputs[k].getAttribute('placeholder') || '') + ' ' + (inputs[k].getAttribute('aria-label') || '');
        if (/search/i.test(label)) { searchLike = true; break; }
      }
    }
    if (!searchLike) return null;
    var markers = /no (?:listings|results|matches)(?: found)?|ไม่พบ(?:ผลลัพธ์|สินค้า|ประกาศ)?|ไม่มี(?:ผลลัพธ์|สินค้า|ประกาศ)/i;
    var nodes = document.querySelectorAll('span, div, p, h1, h2, h3'), n;
    for (n = 0; n < nodes.length && n < 400; n++){
      var text = clean(nodes[n].textContent);
      if (text && text.length <= 120 && markers.test(text)) return text;
    }
    return null;
  }
  function done(){
    var payload = {
      url: location.href,
      html: (document.documentElement.outerHTML || '').slice(0, MAX_HTML),
      cards: collectCards(),
      scope: { area: null, radiusKm: null },
      emptyMessage: emptyMessage(),
      loginVisible: loginVisible()
    };
    window.ReactNativeWebView.postMessage(MARKER + JSON.stringify(payload));
  }
  function ready(){ return document.querySelectorAll('a[href*="/marketplace/item/"]').length > 0; }
  function wait(){
    if (ready() || Date.now() >= deadline) { setTimeout(done, ${JSON.stringify(opts.settleMs)}); }
    else { setTimeout(wait, 250); }
  }
  wait();
})(); true;`;
}
