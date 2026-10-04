import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
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

  const pump = useCallback(() => {
    if (activeRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    activeRef.current = next;
    setActive(next);
    timerRef.current = setTimeout(() => {
      const req = activeRef.current;
      activeRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setActive(null);
      req?.reject(new Error("webview render timed out"));
      pump();
    }, next.timeoutMs);
  }, []);

  const finish = useCallback(
    (html: string | null, error: Error | null) => {
      const req = activeRef.current;
      if (!req) return;
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
            reject(new Error("webview queue full"));
            return;
          }
          queueRef.current.push({
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
      const err = new Error("webview host unmounted");
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

  return (
    <View
      style={{ width: 0, height: 0, overflow: "hidden" }}
      pointerEvents="none"
    >
      <WebView
        source={{ uri: active.url }}
        originWhitelist={["*"]}
        javaScriptEnabled
        injectedJavaScript={buildInjectedJS({
          waitForSelector: active.waitForSelector,
          timeoutMs: active.timeoutMs,
          settleMs: SETTLE_MS,
        })}
        onMessage={(event) => finish(event.nativeEvent.data, null)}
        onError={(event) =>
          finish(null, new Error(event.nativeEvent.description || "webview error"))
        }
        onHttpError={(event) =>
          finish(
            null,
            new Error(`webview HTTP ${event.nativeEvent.statusCode}`),
          )
        }
      />
    </View>
  );
}
