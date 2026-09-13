import type { Href } from "expo-router";

type BackCapableRouter = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: Href) => void;
};

// Deep links (web URLs, notification taps, cold starts) can land on a screen
// with no navigation history, where router.back() silently does nothing.
// Prefer back, but fall back to replacing with a safe route.
export function goBackOrHome(
  router: BackCapableRouter,
  fallback: Href = "/(tabs)",
): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
