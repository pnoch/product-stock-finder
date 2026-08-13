import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import {
  requestNotificationPermissions,
  setupAndroidNotificationChannel,
} from "@/lib/notifications";
import {
  getWatchlist,
  addToWatchlist,
  updateProductListings,
  getSettings,
  defaultStorage,
} from "@/lib/storage";
import {
  registerPriceCheckTask,
  checkPriceDropsNow,
} from "@/lib/background-price-check";
import { PRODUCT_CATALOG } from "@/lib/catalog";
import { SAMPLE_LISTINGS } from "@/lib/sample-data";
import { DistributorListing } from "@/lib/types";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import {
  initManusRuntime,
  subscribeSafeAreaInsets,
} from "@/lib/_core/manus-runtime";
import { useAuth } from "@/hooks/use-auth";
import { setupSync, type SyncSetup } from "@/lib/sync";
import { backfillLocalHistory } from "@/lib/history-sync";
import { syncServerNotifications } from "@/lib/server-notifications";
import { registerPushToken } from "@/lib/push-token";

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

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  // Request notification permissions and set up Android channel on first load
  useEffect(() => {
    if (Platform.OS === "web") return;
    setupAndroidNotificationChannel().then(async () => {
      // Only prompt for notification permission if the user has enabled notifications
      const settings = await getSettings();
      if (settings.notificationsEnabled) {
        await requestNotificationPermissions();
      }
      // Register background price-check task
      registerPriceCheckTask();
      // Run a foreground check immediately on app launch
      checkPriceDropsNow();
      // Register for Expo push delivery (best-effort)
      void registerPushToken();
      // Pull any server-queued notification events
      void syncServerNotifications();
    });
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
            CRS804_SEED_LISTINGS,
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
        listings: CRS804_SEED_LISTINGS,
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
            CRS326_SEED_LISTINGS,
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
        listings: CRS326_SEED_LISTINGS,
      });
    }
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

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

  const { isAuthenticated } = useAuth();
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;
  const syncRef = useRef<SyncSetup | null>(null);

  useEffect(() => {
    syncRef.current = setupSync({
      storage: defaultStorage,
      isSignedIn: () => isAuthenticatedRef.current,
      pull: (since) => trpcClient.sync.pull.query({ since }),
      push: (items) => trpcClient.sync.push.mutate({ items }),
    });
  }, [trpcClient]);

  useEffect(() => {
    if (isAuthenticated) {
      syncRef.current?.syncNow();
      void backfillLocalHistory();
    }
  }, [isAuthenticated]);

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

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>
        {content}
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
