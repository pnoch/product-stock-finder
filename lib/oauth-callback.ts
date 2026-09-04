// Client-side OAuth callback helpers.
//
// Security rule: the app NEVER accepts a raw session token (or user object)
// from a URL. Those are attacker-controllable (login CSRF / session
// fixation). The only accepted credential from a callback URL is a
// short-lived, single-use, device-bound ticket issued by our own server,
// which is redeemed over POST and validated server-side.

export type OAuthCallbackParams = {
  ticket?: unknown;
  error?: unknown;
  error_description?: unknown;
  // Legacy raw-token params are intentionally ignored (see above).
  sessionToken?: unknown;
  user?: unknown;
};

export type OAuthCallbackAction =
  | { action: "redeem"; ticket: string }
  | { action: "failed"; message: string }
  | { action: "redirect"; to: "/" };

function firstString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value.find((entry): entry is string => typeof entry === "string");
    return first;
  }
  return undefined;
}

export function parseOAuthCallbackParams(
  params: OAuthCallbackParams,
): OAuthCallbackAction {
  const error = firstString(params.error);
  if (error) {
    return {
      action: "failed",
      message: firstString(params.error_description) ?? error,
    };
  }
  const ticket = firstString(params.ticket)?.trim();
  if (!ticket) return { action: "redirect", to: "/" };
  return { action: "redeem", ticket };
}

export async function redeemOAuthTicket(
  ticket: string,
  opts: { baseUrl: string; deviceId?: string },
): Promise<{ sessionToken: string; user: unknown }> {
  const res = await fetch(
    `${opts.baseUrl.replace(/\/$/, "")}/api/auth/oauth/consume`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket, deviceId: opts.deviceId }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    sessionToken?: string;
    user?: unknown;
    error?: string;
  };
  if (!res.ok || !data.sessionToken) {
    throw new Error(data.error ?? "OAuth sign-in failed");
  }
  return { sessionToken: data.sessionToken, user: data.user };
}
