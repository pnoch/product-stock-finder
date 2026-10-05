// lib/scrapers/plain-fetch.ts
//
// The server fetches plain HTTP with `impit` (a Chrome-shaped TLS/JA4
// fingerprint), which passes TLS-fingerprint gates that undici does not.
// Mobile/web/tests use the global `fetch` so the React Native path and the
// fetch-stubbing test suite are unchanged. `impit` is imported lazily so it
// never enters the mobile/web bundle or the node test transform.

export interface PlainResponse {
  status: number;
  statusText: string;
  ok: boolean;
  text(): Promise<string>;
}

interface PlainInit {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function shouldUseImpit(): boolean {
  return (
    typeof window === "undefined" &&
    process.env.NODE_ENV !== "test" &&
    !process.env.VITEST
  );
}

let impitInstance: { fetch: (url: string, init?: PlainInit) => Promise<PlainResponse> } | null =
  null;
let impitFailed = false;

async function getImpit() {
  if (impitInstance || impitFailed) return impitInstance;
  try {
    const { Impit } = await import("impit");
    impitInstance = new Impit({ browser: "chrome", timeout: 20_000 });
    return impitInstance;
  } catch {
    impitFailed = true;
    return null;
  }
}

export async function plainFetch(
  url: string,
  init?: PlainInit,
): Promise<PlainResponse> {
  if (shouldUseImpit()) {
    const impit = await getImpit();
    // A missing/unsupported impit falls back to global fetch; a request error
    // propagates so the caller's retry/breaker logic still applies.
    if (impit) return impit.fetch(url, init);
  }
  return fetch(url, init as RequestInit);
}
