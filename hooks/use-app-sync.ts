import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { showAlert } from "@/lib/alert";
import { defaultStorage, getSyncMeta } from "@/lib/storage";
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
import {
  registerDeviceRevokedHandler,
  resetDeviceRevoked,
} from "@/lib/device-revoked";
import type { createTRPCClient } from "@/lib/trpc";

export function useAppSync({
  trpcClient,
  isAuthenticated,
  refresh,
}: {
  trpcClient: ReturnType<typeof createTRPCClient>;
  isAuthenticated: boolean;
  refresh: () => void;
}) {
  const isAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);
  const syncRef = useRef<SyncSetup | null>(null);

  useEffect(() => {
    if (!isServerConfigured()) return;
    const setup = setupSync({
      storage: defaultStorage,
      isSignedIn: () => isAuthenticatedRef.current,
      pull: (since, cursor) =>
        trpcClient.sync.pull.query({ since, cursor: cursor ?? null }),
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
      void registerPushToken();
      void syncServerNotifications();
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
    void loadFxRates().catch(() => {});
    void maybeRefreshFxRates().catch(() => {});
  }, []);
}
