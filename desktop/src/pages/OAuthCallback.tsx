import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { parseOAuthCallbackParams, redeemOAuthTicket } from "../../../lib/oauth-callback";
import { getApiBaseUrl } from "../lib/api-base";
import { getDesktopDeviceId } from "../lib/device-id";
import { mapUser, setSessionToken, setUserInfo } from "../hooks/use-auth";

export function OAuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const action = parseOAuthCallbackParams({
        ticket: params.get("ticket") ?? undefined,
        error: params.get("error") ?? undefined,
        error_description: params.get("error_description") ?? undefined,
      });
      if (action.action === "redirect") {
        if (!cancelled) navigate("/", { replace: true });
        return;
      }
      if (action.action === "failed") {
        if (!cancelled) setError(action.message);
        return;
      }
      try {
        const baseUrl = getApiBaseUrl();
        if (!baseUrl) throw new Error("Server not configured");
        const deviceId = await getDesktopDeviceId().catch(() => undefined);
        const { sessionToken, user } = await redeemOAuthTicket(action.ticket, {
          baseUrl,
          deviceId,
        });
        const rawUser = (user ?? {}) as Record<string, unknown>;
        const id = typeof rawUser.id === "number" ? rawUser.id : Number(rawUser.id);
        const openId = typeof rawUser.openId === "string" ? rawUser.openId : "";
        if (!Number.isFinite(id) || !openId) {
          throw new Error("OAuth sign-in returned an invalid user");
        }
        setSessionToken(sessionToken);
        setUserInfo(
          mapUser({
            id,
            openId,
            name: typeof rawUser.name === "string" ? rawUser.name : null,
            email: typeof rawUser.email === "string" ? rawUser.email : null,
            emailVerified:
              typeof rawUser.emailVerified === "number" ||
              typeof rawUser.emailVerified === "boolean"
                ? rawUser.emailVerified
                : null,
            loginMethod:
              typeof rawUser.loginMethod === "string" ? rawUser.loginMethod : "oauth",
            lastSignedIn:
              typeof rawUser.lastSignedIn === "string" ? rawUser.lastSignedIn : undefined,
          }),
        );
        if (!cancelled) navigate("/", { replace: true });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "OAuth sign-in failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, navigate]);

  if (!error) return null;
  return (
    <div className="p-6 space-y-4 max-w-md">
      <h1 className="text-2xl font-bold">Sign-in failed</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
      <Link
        to="/settings"
        className="inline-flex px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
      >
        Back to Settings
      </Link>
    </div>
  );
}
