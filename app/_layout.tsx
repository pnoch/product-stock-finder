import { log } from "@shared/log";
import { useNotificationSetup } from "@/hooks/use-notification-setup";
import { useAppSync } from "@/hooks/use-app-sync";
import { useOnboardingGate } from "@/hooks/use-onboarding-gate";
import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import {
  ActivityIndicator,
  Platform,
  View,
  useColorScheme,
} from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { SettingsProvider } from "@/lib/settings-provider";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { WebViewFetchHost } from "@/components/webview-fetch-host";
import { seedWatchlistProducts } from "@/lib/launch-seed";
import { defaultStorage } from "@/lib/storage";
import { notificationRouteFor } from "@/lib/notification-routing";
import { setupWebNotifications } from "@/lib/web-notifications";
import { ConciergeScreen } from "@/components/onboarding/concierge-screen";
import { registerServiceWorker } from "@/lib/web-push";
import { PRODUCT_CATALOG } from "@shared/catalog";
import { SAMPLE_LISTINGS, freshenSampleListings } from "@/lib/sample-data";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient, trpcHeaders } from "@/lib/trpc";
import { setDiscoveryHeadersProvider } from "@/lib/llm-discovery";
import { ToastProvider } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { Colors } from "@/lib/_core/theme";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

// Discovery does a raw fetch (the tRPC client can't wrap its abort/timeout
// needs), so register the API headers it must carry — auth + BYO-LLM.
setDiscoveryHeadersProvider(trpcHeaders);

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

  // Initialize unhandled rejection handler (web only).
  // NOTE: on React Native `global.window === global`, so a bare
  // `typeof window !== "undefined"` check is TRUE on native while
  // `window.addEventListener` is undefined — calling it crashed the app on
  // launch. Gate on the platform, not on the existence of `window`.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: PromiseRejectionEvent) => log.error(e.reason);
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  useNotificationSetup({ rootNavigationReadyRef, pendingRouteRef });

  // Web notifications: poll server events while the tab is open
  useEffect(() => {
    if (Platform.OS !== "web") return;
    void registerServiceWorker();
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
    }).catch((err) => log.error("Seeding failed:", err));
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

  useAppSync({ trpcClient, isAuthenticated, refresh });

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

  const { onboardingState, setOnboardingState, isPublic } = useOnboardingGate({
    rootNavigationReadyRef,
    pendingRouteRef,
  });

  if (onboardingState === "checking" && !isPublic) {
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
  if (onboardingState === "intro" && !isPublic) {
    return (
      <ThemeProvider>
        <SettingsProvider>
          <ConciergeScreen onComplete={() => setOnboardingState("app")} />
        </SettingsProvider>
      </ThemeProvider>
    );
  }

  const content = (
    <SettingsProvider>
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
          <WebViewFetchHost />
          <StatusBar style="auto" />
        </QueryClientProvider>
      </trpc.Provider>
      </GestureHandlerRootView>
    </SettingsProvider>
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
