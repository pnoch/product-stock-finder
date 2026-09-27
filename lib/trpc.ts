import { httpBatchLink, type TRPCLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { observable, tap } from "@trpc/server/observable";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import { getDeviceId } from "@/lib/device-id";
import { getSettings } from "@/lib/storage";
import { handleDeviceRevoked } from "@/lib/device-revoked";
import { getBackgroundAppState } from "@/lib/background-safe-timers";
import { backgroundFetch } from "@/lib/background-fetch";
import { DEVICE_REVOKED_ERR_MSG } from "@/shared/const";
import * as Auth from "@/lib/_core/auth";

// Native (XHR) timeout for tRPC calls made while the app is backgrounded.
// Tight: the background task has a 25s budget shared across every listing, and
// an unreachable server must fail fast so remaining listings still fit.
const BACKGROUND_TRPC_TIMEOUT_MS = 4_000;

// Foreground deadline. Without it an unreachable server hangs the fetch until
// the OS TCP timeout (minutes) — e.g. "Refresh all" pins its spinner and the
// sync queue never flushes. Generous enough for slow mobile networks.
const FOREGROUND_TRPC_TIMEOUT_MS = 15_000;

/**
 * tRPC React client for type-safe API calls.
 *
 * IMPORTANT (tRPC v11): The `transformer` must be inside `httpBatchLink`,
 * NOT at the root createClient level. This ensures client and server
 * use the same serialization format (superjson).
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Forwards the user's BYO-LLM provider config as `x-llm-*` request headers so
 * the server can route discovery/insights through their own key. Returns an
 * empty object for the built-in Forge provider (or when settings are unreadable)
 * so the default path sends nothing extra.
 */
export async function byoLlmHeaders(): Promise<Record<string, string>> {
  try {
    const settings = await getSettings();
    const provider = settings?.llmProvider;
    // Clamp to the providers the server accepts: the value comes from persisted
    // or imported settings, so it is not guaranteed to be one of the union.
    if (
      !provider ||
      provider === "forge" ||
      !["openai", "ollama", "ollama-local"].includes(provider)
    ) {
      return {};
    }
    const headers: Record<string, string> = {};
    headers["x-llm-provider"] = provider;
    if (settings.llmApiKey) headers["x-llm-key"] = settings.llmApiKey;
    if (settings.llmModel) headers["x-llm-model"] = settings.llmModel;
    if (settings.llmOllamaUrl) headers["x-llm-url"] = settings.llmOllamaUrl;
    return headers;
  } catch {
    return {};
  }
}

/**
 * Detects the device-revoked error server-side and clears the local session
 * so the next UI refresh signs the user out.
 */
const revokedDeviceLink: TRPCLink<AppRouter> = () => {
  return ({ op, next }) => {
    return observable((observer) => {
      return next(op)
        .pipe(
          tap({
            error(result) {
              if (
                result instanceof Error &&
                result.message.includes(DEVICE_REVOKED_ERR_MSG)
              ) {
                void handleDeviceRevoked();
              }
            },
          }),
        )
        .subscribe(observer);
    });
  };
};

/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
/**
 * Auth + BYO-LLM headers for any request to the API. Exported so non-tRPC call
 * sites (e.g. `lib/llm-discovery`'s raw fetch, which the tRPC client can't wrap)
 * can carry the same session and provider config.
 */
export async function trpcHeaders(): Promise<Record<string, string>> {
  const token = await Auth.getSessionToken();
  // Never let a device-id failure reject header construction for every request.
  const deviceId = await getDeviceId().catch(() => undefined);
  // BYO-LLM: forward the user's provider config so the server routes
  // discovery/insights through their own key. Never sent for the built-in Forge
  // provider.
  const llmHeaders = await byoLlmHeaders();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(deviceId ? { "x-device-id": deviceId } : {}),
    ...llmHeaders,
  };
}

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      revokedDeviceLink,
      httpBatchLink({
        url: `${getApiBaseUrl()}/api/trpc`,
        // tRPC v11: transformer MUST be inside httpBatchLink, not at root
        transformer: superjson,
        headers: trpcHeaders,
        // Custom fetch to include credentials for cookie-based auth
        fetch(url, options) {
          if (getBackgroundAppState() === "background") {
            // JS timers freeze while backgrounded, so a Promise.race timeout
            // can never fire. Enforce the deadline natively instead (XHR
            // timeout → OkHttp callTimeout) and map the response back to the
            // fetch API shape tRPC expects.
            return backgroundFetch(String(url), BACKGROUND_TRPC_TIMEOUT_MS, {
              ...(options?.headers as Record<string, string> | undefined),
            }).then(({ html, status }) => new Response(html, { status }));
          }
          // AbortController deadline: fails fast when the server is
          // unreachable instead of hanging until the OS TCP timeout.
          const controller = new AbortController();
          const timer = setTimeout(
            () => controller.abort(),
            FOREGROUND_TRPC_TIMEOUT_MS,
          );
          return fetch(url, {
            ...options,
            credentials: "include",
            signal: controller.signal,
          }).finally(() => clearTimeout(timer));
        },
      }),
    ],
  });
}
