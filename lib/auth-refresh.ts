export interface RefreshedAuthUser {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string;
  lastSignedIn: string;
  emailVerified: boolean;
}

/**
 * Fetches the current user from `/api/auth/me`.
 *
 * Both clients cache the user (localStorage / the native store) and only refresh
 * it on sign-in, so an email verification completed outside the app — the emailed
 * link opened in a browser — left `emailVerified` false and the "check your
 * email" banner survived until a re-login. Callers publish the result into their
 * own auth state.
 */
export async function fetchCurrentUser(
  apiBaseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RefreshedAuthUser | null> {
  if (!apiBaseUrl) return null;
  try {
    const res = await fetchImpl(
      `${apiBaseUrl.replace(/\/+$/, "")}/api/auth/me`,
      { credentials: "include" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: unknown };
    const user = data?.user as Partial<RefreshedAuthUser> | null | undefined;
    if (!user || typeof user.id !== "number" || typeof user.openId !== "string") {
      return null;
    }
    return {
      id: user.id,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? "email",
      lastSignedIn: user.lastSignedIn ?? new Date().toISOString(),
      emailVerified: Boolean(user.emailVerified),
    };
  } catch {
    return null;
  }
}
