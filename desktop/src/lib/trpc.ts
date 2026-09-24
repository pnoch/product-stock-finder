import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, type TRPCLink } from "@trpc/client";
import { observable, tap } from "@trpc/server/observable";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";
import { getSessionToken, handleDeviceRevoked } from "../hooks/use-auth";
import { getApiBaseUrl } from "./api-base";
import { getDesktopDeviceId } from "./device-id";
import { DEVICE_REVOKED_ERR_MSG } from "../../../shared/const";

export const trpc = createTRPCReact<AppRouter>();

// Detects the device-revoked error server-side and clears the local session so
// the next UI refresh signs the user out (parity with mobile lib/trpc.ts).
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
                handleDeviceRevoked();
              }
            },
          }),
        )
        .subscribe(observer);
    });
  };
};

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      revokedDeviceLink,
      httpBatchLink({
        url: `${getApiBaseUrl()}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = getSessionToken();
          const deviceId = await getDesktopDeviceId();
          return {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "x-device-id": deviceId,
          };
        },
      }),
    ],
  });
}
