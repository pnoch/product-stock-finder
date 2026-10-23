import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { router, usePathname } from "expo-router";
import { log } from "@shared/log";
import { hasSeenOnboarding, isPublicRoute } from "@/lib/onboarding";
import { getWatchlist, updateProductListings } from "@/lib/storage";
import { rediscoverMissingListings } from "@/lib/manual-add";
import { discoverListings } from "@/lib/listing-discovery";
import { checkPriceDropsNow } from "@/lib/background-price-check";
import { notificationRouteFor } from "@/lib/notification-routing";

export function useOnboardingGate({
  rootNavigationReadyRef,
  pendingRouteRef,
}: {
  rootNavigationReadyRef: MutableRefObject<boolean>;
  pendingRouteRef: MutableRefObject<
    ReturnType<typeof notificationRouteFor> | "/(tabs)" | null
  >;
}) {
  const [onboardingState, setOnboardingState] = useState<
    "checking" | "app" | "intro"
  >("checking");
  const pathname = usePathname();
  const isPublic = isPublicRoute(pathname);

  useEffect(() => {
    void hasSeenOnboarding().then((seen) =>
      setOnboardingState(seen ? "app" : "intro"),
    );
  }, []);

  useEffect(() => {
    if (onboardingState !== "app") return;
    rootNavigationReadyRef.current = true;
    const pending = pendingRouteRef.current;
    if (pending) {
      pendingRouteRef.current = null;
      const t = setTimeout(() => router.push(pending), 0);
      return () => clearTimeout(t);
    }
  }, [onboardingState, rootNavigationReadyRef, pendingRouteRef]);

  const launchCheckRanRef = useRef(false);
  useEffect(() => {
    if (onboardingState !== "app" || launchCheckRanRef.current) return;
    launchCheckRanRef.current = true;
    void checkPriceDropsNow().catch((e) =>
      log.error("[Launch] price check failed", e),
    );
    void rediscoverMissingListings({
      storage: { getWatchlist, updateProductListings },
      discover: discoverListings,
    }).catch((e) => log.error("[Launch] missing-listings discovery failed", e));
  }, [onboardingState]);

  return { onboardingState, setOnboardingState, isPublic };
}
