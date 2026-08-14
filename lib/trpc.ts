import { httpBatchLink, type TRPCLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { observable, tap } from "@trpc/server/observable";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import { getDeviceId } from "@/lib/device-id";
import { handleDeviceRevoked } from "@/lib/device-revoked";
import { DEVICE_REVOKED_ERR_MSG } from "@/shared/const";
import * as Auth from "@/lib/_core/auth";

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
      return next(op).pipe(
        tap({
          error(result) {
            if (
              result instanceof Error &&
              result.message === DEVICE_REVOKED_ERR_MSG
            ) {
              void handleDeviceRevoked();
            }
          },
        }),
      ).subscribe(observer);
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
          const deviceId = await getDeviceId();
          return {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "x-device-id": deviceId,
          };
        },
        // Custom fetch to include credentials for cookie-based auth
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include",
          });
        },
      }),
    ],
  });
}