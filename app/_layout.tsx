import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import "@/lib/notifications"; // registers setNotificationHandler at module level
import { requestNotificationPermissions, setupAndroidNotificationChannel } from "@/lib/notifications";
import { getWatchlist, addToWatchlist, updateProductListings } from "@/lib/storage";
import { PRODUCT_CATALOG } from "@/lib/catalog";
import { DistributorListing } from "@/lib/types";

// CRS804 listings seeded at first launch so Home/Watchlist badges show real status immediately
const CRS804_SEED_LISTINGS: DistributorListing[] = [
  { distributorId: "server2u-my", productId: "mikrotik-crs804-4ddq-hrm", price: 5568, currency: "MYR", stockStatus: "in_stock", url: "https://server2u.com/shop/crs804-4ddq-hrm-mikrotik-crs804-4ddq-hrm-400g-master-switch-66247", lastChecked: new Date().toISOString(), priceHistory: [] },
  { distributorId: "mikrotikstore-de", productId: "mikrotik-crs804-4ddq-hrm", price: 1141.67, currency: "EUR", stockStatus: "in_stock", url: "https://mikrotik-store.eu/en/cloud-router-switches/crs804-4ddq-hrm", lastChecked: new Date().toISOString(), priceHistory: [] },
  { distributorId: "interprojekt-pl", productId: "mikrotik-crs804-4ddq-hrm", price: 860.54, currency: "EUR", stockStatus: "back_order", expectedDate: "Sept 15, 2026", url: "https://interprojekt.pl/en/p/mikrotik-crs804-4ddq-hrm.html", lastChecked: new Date().toISOString(), priceHistory: [] },
  { distributorId: "nasstore-eu", productId: "mikrotik-crs804-4ddq-hrm", price: 956.0, currency: "EUR", stockStatus: "back_order", expectedDate: "Aug 13, 2026", url: "https://nasstore.eu/product/mikrotik-cloud-router-switch-crs804-4ddq-hrm/", lastChecked: new Date().toISOString(), priceHistory: [] },
  { distributorId: "aerial-gr", productId: "mikrotik-crs804-4ddq-hrm", price: 956.99, currency: "EUR", stockStatus: "back_order", expectedDate: "Sept 9, 2026", url: "https://aerial.net/shop/product/mikrotik-crs804-4ddq-hrm-cloud-router-switch-5671", lastChecked: new Date().toISOString(), priceHistory: [] },
  { distributorId: "linitx-uk", productId: "mikrotik-crs804-4ddq-hrm", price: 1139.99, currency: "GBP", stockStatus: "back_order", expectedDate: "Sept 18, 2026", url: "https://linitx.com/product/mikrotik-crs804-ddq-cloud-router-400gb-4-port-switch-crs804-4ddq-hrm/18455", lastChecked: new Date().toISOString(), priceHistory: [] },
  { distributorId: "miro-za", productId: "mikrotik-crs804-4ddq-hrm", price: 30140, currency: "ZAR", stockStatus: "back_order", expectedDate: "Aug 2026", url: "https://miro.co.za/07-networking-switches---managed-layer-3/8878-mikrotik-cloud-router-switch-crs804-4ddq-hrm-miro.html", lastChecked: new Date().toISOString(), priceHistory: [] },
  { distributorId: "getic-gr", productId: "mikrotik-crs804-4ddq-hrm", price: 877.64, currency: "EUR", stockStatus: "out_of_stock", url: "https://www.getic.com/product/mikrotik-crs804-4ddq-hrm", lastChecked: new Date().toISOString(), priceHistory: [] },
  { distributorId: "duxtel-au", productId: "mikrotik-crs804-4ddq-hrm", price: 2299, currency: "AUD", stockStatus: "out_of_stock", url: "https://store.duxtel.com.au/product/crs804-4ddq-hrm", lastChecked: new Date().toISOString(), priceHistory: [] },
];
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";

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
    setupAndroidNotificationChannel().then(() => {
      requestNotificationPermissions();
    });
  }, []);

  // Seed CRS804 into watchlist on first launch if watchlist is empty
  useEffect(() => {
    async function seedCRS804() {
      const watchlist = await getWatchlist();
      const existing = watchlist.find((p) => p.id === "mikrotik-crs804-4ddq-hrm");
      if (existing) {
        // Backfill listings if the product was seeded without listing data
        if (!existing.listings || existing.listings.length === 0) {
          await updateProductListings("mikrotik-crs804-4ddq-hrm", CRS804_SEED_LISTINGS);
        }
        return;
      }
      // First launch: add CRS804 with full listing data
      const crs804 = PRODUCT_CATALOG.find((p) => p.id === "mikrotik-crs804-4ddq-hrm");
      if (!crs804) return;
      await addToWatchlist({
        ...crs804,
        isWatched: true,
        addedAt: new Date().toISOString(),
        listings: CRS804_SEED_LISTINGS,
      });
    }
    seedCRS804();
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

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
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
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
