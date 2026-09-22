import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "has_seen_onboarding";

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export async function hasSeenOnboarding(
  store: KeyValueStore = AsyncStorage,
): Promise<boolean> {
  try {
    return (await store.getItem(KEY)) === "true";
  } catch {
    return true;
  }
}

export async function setOnboardingSeen(
  store: KeyValueStore = AsyncStorage,
): Promise<void> {
  try {
    await store.setItem(KEY, "true");
  } catch {
    // Best-effort persistence.
  }
}

// Routes that must be reachable before (or without) completing the first-run
// onboarding tour: the store-required legal page, email-verification and
// password-reset deep links, the OAuth callback, and public shared watchlists.
// The root layout otherwise renders the onboarding carousel for every route,
// so a fresh visitor to /privacy (required by the App Store and Play Store) or
// an emailed verification link only ever sees the tour.
export const PUBLIC_ROUTES = [
  "/privacy",
  "/verify-email",
  "/reset-password",
  "/reset",
  "/oauth/callback",
] as const;

export function isPublicRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  if (path === "/w" || path.startsWith("/w/")) return true;
  return PUBLIC_ROUTES.some((route) => path === route);
}
