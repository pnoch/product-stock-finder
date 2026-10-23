import { useEffect, type MutableRefObject } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { log } from "@shared/log";
import {
  requestNotificationPermissions,
  setupAndroidNotificationChannel,
  setupPushEventTracking,
} from "@/lib/notifications";
import { getSettings } from "@/lib/storage";
import {
  registerPriceCheckTask,
  registerHealthProbeTask,
} from "@/lib/background-price-check";
import { setBackgroundAppState } from "@/lib/background-safe-timers";
import { isServerConfigured } from "@/constants/oauth";
import { syncServerNotifications } from "@/lib/server-notifications";
import { registerPushToken } from "@/lib/push-token";
import { notificationRouteFor } from "@/lib/notification-routing";

export function useNotificationSetup({
  rootNavigationReadyRef,
  pendingRouteRef,
}: {
  rootNavigationReadyRef: MutableRefObject<boolean>;
  pendingRouteRef: MutableRefObject<
    ReturnType<typeof notificationRouteFor> | "/(tabs)" | null
  >;
}) {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = AppState.addEventListener("change", (state) => {
      setBackgroundAppState(state === "active" ? "foreground" : "background");
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const handledResponses = new Map<string, number>();
    const handleNotificationResponse = (
      response: Notifications.NotificationResponse,
    ) => {
      const rawId = response.notification.request.identifier;
      const dataForId = response.notification.request.content.data as {
        eventId?: string;
        productId?: string;
        distributorId?: string;
        type?: string;
      };
      const fallbackId =
        dataForId?.eventId ?? dataForId?.productId ?? dataForId?.type ?? "unknown";
      const id = rawId ?? `${fallbackId}:${response.actionIdentifier ?? "default"}`;
      const now = Date.now();
      const last = handledResponses.get(id);
      if (last !== undefined && now - last < 2000) return;
      handledResponses.set(id, now);
      for (const [k, v] of handledResponses.entries()) {
        if (now - v > 10_000) handledResponses.delete(k);
      }
      if (handledResponses.size > 100) {
        const oldest = [...handledResponses.entries()].sort((a, b) => a[1] - b[1])[0]?.[0];
        if (oldest) handledResponses.delete(oldest);
      }
      const data = dataForId;
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
    const stopPushTracking = setupPushEventTracking();
    void setupAndroidNotificationChannel().catch((e) =>
      log.error("[Launch] notification channel setup failed", e),
    );
    void (async () => {
      try {
        const settings = await getSettings().catch(() => null);
        if (settings?.notificationsEnabled) {
          await requestNotificationPermissions();
        }
      } catch (e) {
        log.error("[Launch] notification permission request failed", e);
      }
    })();
    registerPriceCheckTask();
    registerHealthProbeTask();
    if (isServerConfigured()) {
      void registerPushToken();
      void syncServerNotifications();
    }
    return () => {
      responseSubscription.remove();
      stopPushTracking();
    };
  }, [rootNavigationReadyRef, pendingRouteRef]);
}
