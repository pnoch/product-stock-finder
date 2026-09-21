import { httpBatchLink, type TRPCLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { observable, tap } from "@trpc/server/observable";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import { getDeviceId } from "@/lib/device-id";
import { handleDeviceRevoked } from "@/lib/device-revoked";
import { getBackgroundAppState } from "@/lib/background-safe-timers";
import { backgroundFetch } from "@/lib/background-fetch";
import { DEVICE_REVOKED_ERR_MSG } from "@/shared/const";
import * as Auth from "@/lib/_core/auth";

// Native (XHR) timeout for tRPC calls made while the app is backgrounded.
// Tight: the background task has a 25s budget shared across every listing, and
// an unreachable server must fail fast so remaining listings still fit.
const BACKGROUND_TRPC_TIMEOUT_MS = 4_000;

/**
 * tRPC React client for type-safe API calls.
 *
 * IMPORTANT (tRPC v11): The `transformer` must be inside `httpBatchLink`,
 * NOT at the root createClient level. This ensures client and server
 * use the same serialization format (superjson).
 */
export const trpc = createTRPCReact<AppRouter>();

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
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      revokedDeviceLink,
      httpBatchLink({
        url: `${getApiBaseUrl()}/api/trpc`,
        // tRPC v11: transformer MUST be inside httpBatchLink, not at root
        transformer: superjson,
        async headers() {
          const token = await Auth.getSessionToken();
          // Never let a device-id failure reject header construction for every
          // request.
          const deviceId = await getDeviceId().catch(() => undefined);
          return {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(deviceId ? { "x-device-id": deviceId } : {}),
          };
        },
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
          return fetch(url, {
            ...options,
            credentials: "include",
          });
        },
      }),
    ],
  });
}
