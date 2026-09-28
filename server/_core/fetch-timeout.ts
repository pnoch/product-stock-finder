// Outbound HTTP with a deadline for the framework helpers. Node's fetch has no
// default timeout, so a hung provider (the paid image API, the local Ollama)
// held the request — and its socket — open indefinitely.
const DEFAULT_TIMEOUT_MS = 60_000;

export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: init.signal ?? controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
