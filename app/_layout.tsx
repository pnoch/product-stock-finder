import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import {
  ActivityIndicator,
  AppState,
  Platform,
  View,
  useColorScheme,
} from "react-native";
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
  getSettings,
  defaultStorage,
  getSyncMeta,
} from "@/lib/storage";
import { seedWatchlistProducts } from "@/lib/launch-seed";
import {
  registerPriceCheckTask,
  registerHealthProbeTask,
  checkPriceDropsNow,
} from "@/lib/background-price-check";
import { setupWebNotifications } from "@/lib/web-notifications";
import { hasSeenOnboarding } from "@/lib/onboarding";
import { OnboardingScreen } from "@/components/onboarding/onboarding-screen";
import { registerWebPushServiceWorker } from "@/lib/web-push";
import { PRODUCT_CATALOG } from "@shared/catalog";
import {
  SAMPLE_LISTINGS,
  freshenSampleListings,
} from "@/lib/sample-data";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { ToastProvider } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { Colors } from "@/lib/_core/theme";
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
import { notificationRouteFor } from "@/lib/notification-routing";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets] = useState<EdgeInsets>(initialInsets);
  const [frame] = useState<Rect>(initialFrame);
  const systemColorScheme = useColorScheme() ?? "light";
  // Notification taps can arrive before the root layout mounts (cold start);
  // expo-router throws if we navigate then, so buffer the route.
  const rootNavigationReadyRef = useRef(false);
  const pendingRouteRef = useRef<
    ReturnType<typeof notificationRouteFor> | "/(tabs)" | null
  >(null);

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
    // Route notification taps to their target screens — dedup with short TTL to avoid double-fire on cold start
    const handledResponses = new Map<string, number>();
    const handleNotificationResponse = (
      response: Notifications.NotificationResponse,
    ) => {
      const rawId = response.notification.request.identifier;
      const dataForId = response.notification.request.content.data as {
        eventId?: string;
        productId?: string;
        type?: string;
      };
      const fallbackId = dataForId?.eventId ?? dataForId?.productId ?? dataForId?.type ?? "unknown";
      const id = rawId ?? `${fallbackId}:${response.actionIdentifier ?? "default"}`;
      const now = Date.now();
      const last = handledResponses.get(id);
      if (last !== undefined && now - last < 2000) return;
      handledResponses.set(id, now);
      // prune entries older than 10s to bound memory + cap size to prevent leak
      for (const [k, v] of handledResponses.entries()) {
        if (now - v > 10_000) handledResponses.delete(k);
      }
      if (handledResponses.size > 100) {
        const oldest = [...handledResponses.entries()].sort((a, b) => a[1] - b[1])[0]?.[0];
        if (oldest) handledResponses.delete(oldest);
      }
      const data = dataForId;
      // expo-router throws if navigation happens before the root layout has
      // mounted (cold start). Defer until the navigation tree is ready.
      const route = notificationRouteFor(data) ?? "/(tabs)";
      if (rootNavigationReadyRef.current) {
        router.push(route);
      } else {
        pendingRouteRef.current = route;
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

  // Seed sample products into the watchlist on first launch (single read, batched)
  useEffect(() => {
    seedWatchlistProducts({
      storage: defaultStorage,
      catalog: PRODUCT_CATALOG,
      sampleListings: SAMPLE_LISTINGS,
      freshen: freshenSampleListings,
    }).catch((err) => console.error("Seeding failed:", err));
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
      pull: (since, cursor) => trpcClient.sync.pull.query({ since, cursor: cursor ?? null }),
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
    let lastActive = 0;
    const onActive = async () => {
      const now = Date.now();
      if (now - lastActive < 1000) return;
      lastActive = now;
      const setup = getSyncSetup();
      if (!setup) return;
      // A storage read failure must not reject unhandled in a focus handler.
      const meta = await getSyncMeta().catch(() => null);
      if (meta?.lastSyncError) void setup.syncNow();
    };
    if (Platform.OS === "web") {
      const onVisibility = () => {
        if (document.visibilityState === "visible") void onActive();
      };
      window.addEventListener("focus", onActive);
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        window.removeEventListener("focus", onActive);
        document.removeEventListener("visibilitychange", onVisibility);
      };
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

  // Mark navigation ready and flush any buffered notification route once the
  // Stack has mounted.
  useEffect(() => {
    rootNavigationReadyRef.current = true;
    const pending = pendingRouteRef.current;
    if (pending) {
      pendingRouteRef.current = null;
      // Defer a tick so the navigator is fully ready.
      const t = setTimeout(() => router.push(pending), 0);
      return () => clearTimeout(t);
    }
  }, []);


  if (onboardingState === "checking") {
    return (
      <ThemeProvider>
        <View
          style={{
            flex: 1,
            backgroundColor: Colors[systemColorScheme].background,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator
            accessibilityLabel="Loading"
            size="large"
            color={Colors[systemColorScheme].primary}
          />
        </View>
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
  const wrapped = (
    <AppErrorBoundary>
      <ToastProvider>{content}</ToastProvider>
    </AppErrorBoundary>
  );

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
