import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { AppState, Platform, View } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { showAlert } from "@/lib/alert";
import {
  requestNotificationPermissions,
  setupAndroidNotificationChannel,
  setupPushEventTracking,
} from "@/lib/notifications";
import {
  getWatchlist,
  addToWatchlist,
  updateProductListings,
  getSettings,
  defaultStorage,
  getSyncMeta,
} from "@/lib/storage";
import {
  registerPriceCheckTask,
  registerHealthProbeTask,
  checkPriceDropsNow,
} from "@/lib/background-price-check";
import { setupWebNotifications } from "@/lib/web-notifications";
import {
  hasSeenOnboarding,
  setOnboardingSeen,
} from "@/lib/onboarding";
import { OnboardingScreen } from "@/components/onboarding/onboarding-screen";
import { registerWebPushServiceWorker } from "@/lib/web-push";
import { PRODUCT_CATALOG } from "@/lib/catalog";
import {
  SAMPLE_LISTINGS,
  freshenSampleListings,
} from "@/lib/sample-data";
import { DistributorListing } from "@/lib/types";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import {
  registerDeviceRevokedHandler,
  resetDeviceRevoked,
} from "@/lib/device-revoked";
import { isServerConfigured } from "@/constants/oauth";
import { cleanupStaleDevices } from "@/lib/devices";
import {
  setupSync,
  registerSyncSetup,
  getSyncSetup,
  type SyncSetup,
} from "@/lib/sync";
import { backfillLocalHistory } from "@/lib/history-sync";
import { syncServerNotifications } from "@/lib/server-notifications";
import { registerPushToken } from "@/lib/push-token";
import { loadFxRates, maybeRefreshFxRates } from "@/lib/fx";

// CRS804 + CRS326 listings seeded at first launch from lib/sample-data.ts so Home/Watchlist
// badges and Product Detail sparklines/charts have full price history immediately.
const CRS804_SEED_LISTINGS: DistributorListing[] =
  SAMPLE_LISTINGS["mikrotik-crs804-4ddq-hrm"] ?? [];
const CRS326_SEED_LISTINGS: DistributorListing[] =
  SAMPLE_LISTINGS["mikrotik-crs326-24s"] ?? [];

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize unhandled rejection handler
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => console.error(e.reason);
    if (typeof window !== "undefined") {
      window.addEventListener("unhandledrejection", handler);
      return () => window.removeEventListener("unhandledrejection", handler);
    }
  }, []);

  // Request notification permissions and set up Android channel on first load
  useEffect(() => {
    if (Platform.OS === "web") return;
    // Route notification taps to their target screens
    const handledResponses = new Set<string>();
    const handleNotificationResponse = (
      response: Notifications.NotificationResponse,
    ) => {
      const id = response.notification.request.identifier;
      if (handledResponses.has(id)) return;
      handledResponses.add(id);
      const data = response.notification.request.content.data as {
        productId?: string;
        type?: string;
      };
      if (data.productId) {
        router.push(`/product/${data.productId}`);
      } else if (data.type === "digest") {
        router.push("/stats");
      } else if (data.type?.startsWith("health")) {
        router.push("/health");
      }
    };
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse,
      );
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleNotificationResponse(response);
      })
      .catch(() => {});
    // Record eventIds from push notifications for dedup (registered first so
    // pushes arriving during channel setup are captured too)
    const stopPushTracking = setupPushEventTracking();
    setupAndroidNotificationChannel().then(async () => {
      // Only prompt for notification permission if the user has enabled notifications
      const settings = await getSettings();
      if (settings.notificationsEnabled) {
        await requestNotificationPermissions();
      }
      // Register background price-check task
      registerPriceCheckTask();
      // Register background health probe task
      registerHealthProbeTask();
      // Run a foreground check immediately on app launch
      checkPriceDropsNow();
      if (isServerConfigured()) {
        // Register for Expo push delivery (best-effort)
        void registerPushToken();
        // Pull any server-queued notification events
        void syncServerNotifications();
      }
    });
    return () => {
      responseSubscription.remove();
      stopPushTracking();
    };
  }, []);

  // Web notifications: poll server events while the tab is open
  useEffect(() => {
    if (Platform.OS !== "web") return;
    void registerWebPushServiceWorker();
    const stopWebNotifications = setupWebNotifications();
    return () => {
      stopWebNotifications();
    };
  }, []);

  // Seed CRS804 into watchlist on first launch if watchlist is empty
  useEffect(() => {
    async function seedCRS804() {
      const watchlist = await getWatchlist();
      const existing = watchlist.find(
        (p) => p.id === "mikrotik-crs804-4ddq-hrm",
      );
      if (existing) {
        // Backfill listings if the product was seeded without listing data
        if (!existing.listings || existing.listings.length === 0) {
          await updateProductListings(
            "mikrotik-crs804-4ddq-hrm",
            freshenSampleListings(CRS804_SEED_LISTINGS),
          );
        }
        return;
      }
      // First launch: add CRS804 with full listing data
      const crs804 = PRODUCT_CATALOG.find(
        (p) => p.id === "mikrotik-crs804-4ddq-hrm",
      );
      if (!crs804) return;
      await addToWatchlist({
        ...crs804,
        isWatched: true,
        addedAt: new Date().toISOString(),
        listings: freshenSampleListings(CRS804_SEED_LISTINGS),
      });
    }
    seedCRS804().then(seedCRS326);
    async function seedCRS326() {
      const watchlist = await getWatchlist();
      const existing = watchlist.find((p) => p.id === "mikrotik-crs326-24s");
      if (existing) {
        if (!existing.listings || existing.listings.length === 0) {
          await updateProductListings(
            "mikrotik-crs326-24s",
            freshenSampleListings(CRS326_SEED_LISTINGS),
          );
        }
        return;
      }
      const crs326 = PRODUCT_CATALOG.find(
        (p) => p.id === "mikrotik-crs326-24s",
      );
      if (!crs326) return;
      await addToWatchlist({
        ...crs326,
        isWatched: true,
        addedAt: new Date().toISOString(),
        listings: freshenSampleListings(CRS326_SEED_LISTINGS),
      });
    }
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  const { isAuthenticated, refresh } = useAuth();
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;
  const syncRef = useRef<SyncSetup | null>(null);

  useEffect(() => {
    if (!isServerConfigured()) return;
    const setup = setupSync({
      storage: defaultStorage,
      isSignedIn: () => isAuthenticatedRef.current,
      pull: (since) => trpcClient.sync.pull.query({ since }),
      push: (items) => trpcClient.sync.push.mutate({ items }),
    });
    syncRef.current = setup;
    const unregister = registerSyncSetup(setup);
    return () => {
      unregister();
      syncRef.current = null;
    };
  }, [trpcClient]);

  // Retry a failed sync when the app returns to the foreground.
  useEffect(() => {
    const onActive = async () => {
      const setup = getSyncSetup();
      if (!setup) return;
      const meta = await getSyncMeta();
      if (meta.lastSyncError) void setup.syncNow();
    };
    if (Platform.OS === "web") {
      window.addEventListener("focus", onActive);
      return () => window.removeEventListener("focus", onActive);
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void onActive();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (isAuthenticated && isServerConfigured()) {
      resetDeviceRevoked();
      syncRef.current?.syncNow();
      void backfillLocalHistory();
      void cleanupStaleDevices();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    return registerDeviceRevokedHandler(() => {
      showAlert("Signed Out", "You were signed out on another device.", [
        { text: "OK", onPress: () => void refresh() },
      ]);
    });
  }, [refresh]);

  useEffect(() => {
    if (!isServerConfigured()) return;
    void loadFxRates();
    void maybeRefreshFxRates();
  }, []);

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? {
      insets: initialInsets,
      frame: initialFrame,
    };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const [onboardingState, setOnboardingState] = useState<
    "checking" | "app" | "intro"
  >("checking");
  useEffect(() => {
    void hasSeenOnboarding().then((seen) =>
      setOnboardingState(seen ? "app" : "intro"),
    );
  }, []);

  if (onboardingState === "checking") {
    return (
      <ThemeProvider>
        <View style={{ flex: 1, backgroundColor: "#F8FAFC" }} />
      </ThemeProvider>
    );
  }
  if (onboardingState === "intro") {
    return (
      <ThemeProvider>
        <OnboardingScreen onComplete={() => setOnboardingState("app")} />
      </ThemeProvider>
    );
  }

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
          {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
          {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="oauth/callback" />
          </Stack>
          <StatusBar style="auto" />
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";
  const wrapped = <AppErrorBoundary>{content}</AppErrorBoundary>;

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {wrapped}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>
        {wrapped}
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
