export type OAuthCallbackParams = {
  sessionToken?: unknown;
  user?: unknown;
};

export type OAuthCallbackAction =
  | {
      action: "authenticated";
      sessionToken: string;
      user: Record<string, unknown>;
    }
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
  const sessionToken = firstString(params.sessionToken)?.trim();
  if (!sessionToken) return { action: "redirect", to: "/" };

  let user: unknown = params.user;
  if (typeof user === "string") {
    try {
      user = JSON.parse(user) as unknown;
    } catch {
      return { action: "redirect", to: "/" };
    }
  }
  if (!user || typeof user !== "object" || Array.isArray(user)) {
    return { action: "redirect", to: "/" };
  }

  return {
    action: "authenticated",
    sessionToken,
    user: user as Record<string, unknown>,
  };
}
