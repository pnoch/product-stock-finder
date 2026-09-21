// XHR-based fetch with a NATIVE timeout, for the Android background-task path.
//
// While backgrounded, every JS setTimeout freezes (TimerManager registers with
// JavaTimerManager, which fires only from the paused choreographer), so a
// Promise.race timeout can never fire and fetches hang forever. The XHR
// `timeout` property, however, is enforced natively (OkHttp callTimeout in
// NetworkingModule) and the timeout result is delivered as a native
// didCompleteNetworkResponse event — which the RuntimeScheduler processes
// while backgrounded (the background task body itself is one).
//
// This module must stay free of react-native imports (it is imported from
// lib/scrapers/resilient.ts, which the server bundle also pulls in).

export interface BackgroundFetchResult {
  html: string;
  status: number;
}

export class BackgroundFetchTimeoutError extends Error {
  constructor() {
    super("background fetch timed out");
    this.name = "BackgroundFetchTimeoutError";
  }
}

/**
 * fetch() via XMLHttpRequest with a native timeout. Resolves with the response
 * text and HTTP status; rejects on network error or timeout. The timeout is
 * enforced by the native networking stack, so it fires while the app is
 * backgrounded (unlike any JS timer).
 */
export function backgroundFetch(
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<BackgroundFetchResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    // Native OkHttp callTimeout — works while backgrounded.
    xhr.timeout = timeoutMs;
    if (headers) {
      for (const [name, value] of Object.entries(headers)) {
        try {
          xhr.setRequestHeader(name, value);
        } catch {
          // Some headers (User-Agent etc.) may be rejected; skip them.
        }
      }
    }
    let settled = false;
    xhr.onload = () => {
      if (settled) return;
      settled = true;
      resolve({ html: String(xhr.response ?? ""), status: xhr.status });
    };
    xhr.onerror = () => {
      if (settled) return;
      settled = true;
      reject(new Error("Network request failed"));
    };
    xhr.ontimeout = () => {
      if (settled) return;
      settled = true;
      reject(new BackgroundFetchTimeoutError());
    };
    xhr.onabort = () => {
      if (settled) return;
      settled = true;
      reject(new Error("Aborted"));
    };
    try {
      xhr.send();
    } catch (error) {
      if (!settled) {
        settled = true;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  });
}