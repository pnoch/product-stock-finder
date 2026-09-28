// Outbound HTTP with a deadline. Node's fetch has no default timeout, so a
// hung upstream (a stalled OAuth token endpoint, an unresponsive mail provider,
// a slow S3 presign) held the request — and for OAuth, the user's login —
// open indefinitely, tying up the socket and the handler.
const DEFAULT_TIMEOUT_MS = 15_000;

export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
