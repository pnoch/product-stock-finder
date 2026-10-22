import { useCallback, useEffect, useState } from "react";
import type { AppSettings } from "../../../lib/types";
import { requestWebNotificationPermission } from "../../../lib/web-notifications";
import {
  isPushSupported,
  ensurePushSubscription,
  disablePush,
  getPushStatus,
  hasVapidKey,
} from "../lib/web-push";

export function usePushNotifications({
  isAuthenticated,
  update,
  showToast,
}: {
  isAuthenticated: boolean;
  update: (partial: Partial<AppSettings>) => Promise<void> | void;
  showToast: (message: string) => void;
}) {
  const [pushState, setPushState] = useState<"unknown" | "on" | "off">("unknown");
  const [pushBusy, setPushBusy] = useState(false);
  const [webNotifHint, setWebNotifHint] = useState<string | null>(null);

  const effectivePushState =
    !isAuthenticated || !isPushSupported() ? "off" : pushState;

  useEffect(() => {
    if (!isAuthenticated || !isPushSupported()) return;
    let cancelled = false;
    void getPushStatus().then((s) => {
      if (!cancelled) setPushState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const pushReason = !isAuthenticated
    ? "Sign in to enable push"
    : !isPushSupported()
      ? "Push isn't available in this browser"
      : !hasVapidKey()
        ? "Push isn't configured on this server"
        : null;

  const handleEnablePush = useCallback(async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const permission = await requestWebNotificationPermission();
      if (permission !== "granted") {
        showToast("Notification permission not granted");
        return;
      }
      const ok = await ensurePushSubscription();
      if (ok) {
        setPushState("on");
        showToast("Push notifications enabled");
      } else {
        showToast("Couldn't enable push notifications");
      }
    } finally {
      setPushBusy(false);
    }
  }, [pushBusy, showToast]);

  const handleDisablePush = useCallback(async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      await disablePush();
      setPushState("off");
      showToast("Push notifications disabled");
    } finally {
      setPushBusy(false);
    }
  }, [pushBusy, showToast]);

  const handleWebToggle = useCallback(
    async (v: boolean) => {
      if (v) {
        const permission = await requestWebNotificationPermission();
        const enabled = permission === "granted";
        await update({ webNotificationsEnabled: enabled });
        setWebNotifHint(
          enabled
            ? null
            : permission === "denied"
              ? "Notifications are blocked in your browser settings."
              : "Allow notifications in your browser to receive alerts.",
        );
      } else {
        await update({ webNotificationsEnabled: false });
        setWebNotifHint(null);
      }
    },
    [update],
  );

  return {
    effectivePushState,
    pushBusy,
    pushReason,
    webNotifHint,
    handleEnablePush,
    handleDisablePush,
    handleWebToggle,
  };
}
