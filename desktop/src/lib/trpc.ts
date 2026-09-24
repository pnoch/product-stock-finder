import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, type TRPCLink } from "@trpc/client";
import { observable, tap } from "@trpc/server/observable";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";
import { getSessionToken, handleDeviceRevoked } from "../hooks/use-auth";
import { getApiBaseUrl } from "./api-base";
import { getDesktopDeviceId } from "./device-id";
import { storage } from "../storage";
import { DEVICE_REVOKED_ERR_MSG } from "../../../shared/const";

export const trpc = createTRPCReact<AppRouter>();

/**
 * Forwards the user's BYO-LLM provider config as `x-llm-*` request headers so
 * the server can route discovery/insights through their own key. Returns an
 * empty object for the built-in Forge provider (or when settings are
 * unreadable) so the default path sends nothing extra.
 */
export async function byoLlmHeaders(): Promise<Record<string, string>> {
  try {
    const settings = await storage.getSettings();
    const provider = settings?.llmProvider;
    if (!provider || provider === "forge") return {};
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
            ...(await byoLlmHeaders()),
          };
        },
      }),
    ],
  });
}
