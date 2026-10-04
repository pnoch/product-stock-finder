import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { BrowserUnavailableError } from "@/lib/scrapers/resilient";
import {
  buildInjectedJS,
  setWebViewHost,
  type WebViewHost,
  type WebViewLoadOptions,
} from "@/lib/scrapers/webview-host";

const DEFAULT_TIMEOUT_MS = 20_000;
const SETTLE_MS = 500;
const MAX_QUEUE = 25;
// Two renderers so a product with several browser-only listings refreshes in
// pairs instead of strictly one at a time. Kept small: each WebView is a full
// native browser instance.
const POOL_SIZE = 2;

interface PendingRequest {
  id: number;
  url: string;
  waitForSelector?: string;
  timeoutMs: number;
  resolve: (html: string) => void;
  reject: (err: Error) => void;
}

/**
 * Mounted once at the app root. Owns a small pool of hidden WebViews that
 * render distributor pages (JS / Cloudflare challenges) and post the rendered
 * HTML back, so on-device scraping can reuse the existing parsers. Up to
 * POOL_SIZE pages render at once; the rest queue. Nothing visible is rendered.
 */
export function WebViewFetchHost() {
  const [slots, setSlots] = useState<(PendingRequest | null)[]>(() =>
    Array<null>(POOL_SIZE).fill(null),
  );
  const slotsRef = useRef<(PendingRequest | null)[]>(
    Array<null>(POOL_SIZE).fill(null),
  );
  const queueRef = useRef<PendingRequest[]>([]);
  const timersRef = useRef<(ReturnType<typeof setTimeout> | null)[]>(
    Array<null>(POOL_SIZE).fill(null),
  );
  const nextIdRef = useRef(0);

  // Fill every free slot from the queue. Each slot owns its own timeout so a
  // slow page only blocks its own renderer.
  const pump = useCallback(() => {
    let changed = false;
    for (let i = 0; i < POOL_SIZE; i++) {
      if (slotsRef.current[i]) continue;
      const next = queueRef.current.shift();
      if (!next) break;
      slotsRef.current[i] = next;
      timersRef.current[i] = setTimeout(() => {
        if (slotsRef.current[i] !== next) return;
        slotsRef.current[i] = null;
        const t = timersRef.current[i];
        if (t) clearTimeout(t);
        timersRef.current[i] = null;
        setSlots([...slotsRef.current]);
        next.reject(new BrowserUnavailableError("webview render timed out"));
        pump();
      }, next.timeoutMs);
      changed = true;
    }
    if (changed) setSlots([...slotsRef.current]);
  }, []);

  const finish = useCallback(
    (
      slot: number,
      req: PendingRequest,
      html: string | null,
      error: Error | null,
    ) => {
      if (slotsRef.current[slot] !== req) return;
      slotsRef.current[slot] = null;
      const t = timersRef.current[slot];
      if (t) clearTimeout(t);
      timersRef.current[slot] = null;
      setSlots([...slotsRef.current]);
      if (error) req.reject(error);
      else req.resolve(html ?? "");
      pump();
    },
    [pump],
  );

  useEffect(() => {
    // Capture the (stable) backing arrays once; the cleanup uses these locals
    // rather than reading `.current` after the effect has run.
    const queue = queueRef.current;
    const slots = slotsRef.current;
    const timers = timersRef.current;
    const host: WebViewHost = {
      load(url: string, opts?: WebViewLoadOptions) {
        return new Promise<string>((resolve, reject) => {
          if (queue.length >= MAX_QUEUE) {
            reject(new BrowserUnavailableError("webview queue full"));
            return;
          }
          queue.push({
            id: nextIdRef.current++,
            url,
            waitForSelector: opts?.waitForSelector,
            timeoutMs: opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            resolve,
            reject,
          });
          pump();
        });
      },
    };
    setWebViewHost(host);
    return () => {
      setWebViewHost(null);
      const err = new BrowserUnavailableError("webview host unmounted");
      for (const req of queue) req.reject(err);
      queue.length = 0;
      for (let i = 0; i < POOL_SIZE; i++) {
        if (slots[i]) {
          slots[i]!.reject(err);
          slots[i] = null;
        }
        const t = timers[i];
        if (t) clearTimeout(t);
        timers[i] = null;
      }
      setSlots([...slots]);
    };
  }, [pump]);

  return (
    <View
      style={{ width: 0, height: 0, overflow: "hidden" }}
      pointerEvents="none"
    >
      {slots.map((req, slot) =>
        req ? (
          <WebView
            key={req.id}
            source={{ uri: req.url }}
            originWhitelist={["*"]}
            javaScriptEnabled
            androidLayerType="software"
            injectedJavaScript={buildInjectedJS({
              waitForSelector: req.waitForSelector,
              timeoutMs: req.timeoutMs,
              settleMs: SETTLE_MS,
            })}
            onMessage={(event) => finish(slot, req, event.nativeEvent.data, null)}
            onError={(event) =>
              finish(
                slot,
                req,
                null,
                new Error(event.nativeEvent.description || "webview error"),
              )
            }
            // Do NOT reject on HTTP error status: a Cloudflare challenge is
            // served as 403 and the page then solves it and reloads, so
            // rejecting here abandons the challenge before it completes (the
            // node Playwright path likewise returns the body for resilient to
            // classify). Only block non-web navigations from the hidden view.
            onShouldStartLoadWithRequest={(r) => /^(https?:|about:)/i.test(r.url)}
          />
        ) : null,
      )}
    </View>
  );
}
