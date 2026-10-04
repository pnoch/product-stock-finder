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

interface PendingRequest {
  id: number;
  url: string;
  waitForSelector?: string;
  timeoutMs: number;
  resolve: (html: string) => void;
  reject: (err: Error) => void;
}

/**
 * Mounted once at the app root. Owns a single hidden WebView that renders
 * distributor pages (JS / Cloudflare challenges) and posts the rendered HTML
 * back, so on-device scraping can reuse the existing parsers. Requests are
 * serialized: one page load at a time. Nothing renders when idle.
 */
export function WebViewFetchHost() {
  const [active, setActive] = useState<PendingRequest | null>(null);
  const queueRef = useRef<PendingRequest[]>([]);
  const activeRef = useRef<PendingRequest | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextIdRef = useRef(0);

  const pump = useCallback(() => {
    if (activeRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    activeRef.current = next;
    setActive(next);
    timerRef.current = setTimeout(() => {
      if (activeRef.current !== next) return;
      activeRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setActive(null);
      next.reject(new BrowserUnavailableError("webview render timed out"));
      pump();
    }, next.timeoutMs);
  }, []);

  const finish = useCallback(
    (req: PendingRequest, html: string | null, error: Error | null) => {
      if (activeRef.current !== req) return;
      activeRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setActive(null);
      if (error) req.reject(error);
      else req.resolve(html ?? "");
      pump();
    },
    [pump],
  );

  useEffect(() => {
    const host: WebViewHost = {
      load(url: string, opts?: WebViewLoadOptions) {
        return new Promise<string>((resolve, reject) => {
          if (queueRef.current.length >= MAX_QUEUE) {
            reject(new BrowserUnavailableError("webview queue full"));
            return;
          }
          queueRef.current.push({
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
      for (const req of queueRef.current) req.reject(err);
      queueRef.current = [];
      if (activeRef.current) {
        activeRef.current.reject(err);
        activeRef.current = null;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [pump]);

  if (!active) return null;

  const request = active;

  return (
    <View
      style={{ width: 0, height: 0, overflow: "hidden" }}
      pointerEvents="none"
    >
      <WebView
        key={request.id}
        source={{ uri: request.url }}
        originWhitelist={["*"]}
        javaScriptEnabled
        androidLayerType="software"
        injectedJavaScript={buildInjectedJS({
          waitForSelector: request.waitForSelector,
          timeoutMs: request.timeoutMs,
          settleMs: SETTLE_MS,
        })}
        onMessage={(event) => finish(request, event.nativeEvent.data, null)}
        onError={(event) =>
          finish(
            request,
            null,
            new Error(event.nativeEvent.description || "webview error"),
          )
        }
        // Do NOT reject on HTTP error status: a Cloudflare challenge is served
        // as 403 and the page then solves it and reloads, so rejecting here
        // abandons the challenge before it completes (the node Playwright path
        // likewise returns the body for resilient to classify). Only block
        // non-web navigations (intent://, market://, tel:) from the hidden view.
        onShouldStartLoadWithRequest={(req) => /^(https?:|about:)/i.test(req.url)}
      />
    </View>
  );
}
