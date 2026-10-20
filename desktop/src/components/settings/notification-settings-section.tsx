import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router";
import type { AppSettings } from "../../../../lib/types";
import { requestWebNotificationPermission } from "../../../../lib/web-notifications";
import {
  isPushSupported,
  ensurePushSubscription,
  disablePush,
  getPushStatus,
  hasVapidKey,
} from "../../lib/web-push";
import { createTRPCClient } from "../../lib/trpc";

const QUIET_HOURS_OPTIONS = [
  "Off",
  "22:00–07:00",
  "23:00–07:00",
  "00:00–08:00",
] as const;

export function NotificationSettingsSection({
  settings,
  update,
  isAuthenticated,
  showToast,
}: {
  settings: AppSettings;
  update: (partial: Partial<AppSettings>) => Promise<void> | void;
  isAuthenticated: boolean;
  showToast: (message: string) => void;
}) {
  const [testNotifMessage, setTestNotifMessage] = useState<string | null>(null);
  const [pushState, setPushState] = useState<"unknown" | "on" | "off">("unknown");
  const [pushBusy, setPushBusy] = useState(false);
  const [webNotifHint, setWebNotifHint] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState(settings.alertWebhookUrl ?? "");
  const [webhookHint, setWebhookHint] = useState<string | null>(null);
  const [webhookHintOk, setWebhookHintOk] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);

  const [prevWebhookUrl, setPrevWebhookUrl] = useState(settings.alertWebhookUrl);
  if (settings.alertWebhookUrl !== prevWebhookUrl) {
    setPrevWebhookUrl(settings.alertWebhookUrl);
    setWebhookUrl(settings.alertWebhookUrl ?? "");
  }

  const handleTestNotification = useCallback(async () => {
    // Exercise the same path real alerts use (Tauri native, falling back to the
    // web Notification API). The old handler only called displayWebNotification,
    // which is a no-op in a Tauri webview (isWeb() is false), so "Test
    // notification sent" could appear without anything being shown.
    const { sendDesktopNotification } = await import("../../notifications");
    const shown = await sendDesktopNotification(
      "Notifications working",
      "Product Stock Finder will alert you here.",
    );
    setTestNotifMessage(
      shown ? "Test notification sent" : "Notification permission not granted",
    );
  }, []);

  // Imperative client (not a mutation hook): desktop tests mock ../lib/trpc
  // without a `notifications` member, so a render-time hook would crash them.
  const handleTestWebhook = useCallback(async () => {
    const url = webhookUrl.trim();
    if (!url) {
      setWebhookHintOk(false);
      setWebhookHint("Enter a webhook URL first.");
      return;
    }
    setWebhookHint(null);
    setWebhookTesting(true);
    try {
      const client = createTRPCClient();
      const result = await client.notifications.testWebhook.mutate({ url });
      setWebhookHintOk(result.ok);
      setWebhookHint(
        result.ok ? "Test message sent." : (result.error ?? "Test failed."),
      );
    } catch {
      setWebhookHintOk(false);
      setWebhookHint("Test failed.");
    } finally {
      setWebhookTesting(false);
    }
  }, [webhookUrl]);

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

  return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Notifications</h2>
        </div>
        <div className="space-y-1">
          <label className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors cursor-pointer">
            <span>
              <span className="block text-sm font-medium">Enable Notifications</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Receive alerts on your device</span>
            </span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) =>
                  update({ notificationsEnabled: e.target.checked })
                }
                className="sr-only peer"
                aria-label="Enable notifications"
              />
              <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
            </span>
          </label>
          <label className={`flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors ${settings.notificationsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <span>
              <span className="block text-sm font-medium">Stock Alerts</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Notify when item comes in stock</span>
            </span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.stockAlerts}
                onChange={(e) => update({ stockAlerts: e.target.checked })}
                disabled={!settings.notificationsEnabled}
                className="sr-only peer"
                aria-label="Enable stock alerts"
              />
              <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
            </span>
          </label>
          <label className={`flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors ${settings.notificationsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <span>
              <span className="block text-sm font-medium">Price Alerts</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Notify when price drops below target</span>
            </span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.priceAlerts}
                onChange={(e) => update({ priceAlerts: e.target.checked })}
                disabled={!settings.notificationsEnabled}
                className="sr-only peer"
                aria-label="Enable price alerts"
              />
              <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
            </span>
          </label>
          <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors">
            <span>
              <span className="block text-sm font-medium">Push notifications</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {effectivePushState === "on" ? "On — alerts arrive even with the app closed." : (pushReason ?? "Off")}
              </span>
            </span>
            <button
              onClick={effectivePushState === "on" ? handleDisablePush : handleEnablePush}
              disabled={pushBusy || (!isAuthenticated && effectivePushState !== "on")}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={effectivePushState === "on" ? "Disable push notifications" : "Enable push notifications"}
            >
              {pushBusy ? "Working" : effectivePushState === "on" ? "Disable" : "Enable"}
            </button>
          </div>
          <label className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors cursor-pointer">
            <span>
              <span className="block text-sm font-medium">Web Notifications</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Show price and stock alerts in your browser</span>
            </span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings.webNotificationsEnabled}
                onChange={(e) => void handleWebToggle(e.target.checked)}
                className="sr-only peer"
                aria-label="Enable web notifications"
              />
              <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
            </span>
          </label>
          {webNotifHint && (
            <p className="px-3 text-xs text-amber-600 dark:text-amber-400">{webNotifHint}</p>
          )}
          <label className={`flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors ${settings.notificationsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <span>
              <span className="block text-sm font-medium">Health Alerts</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Notify when a distributor is blocked or down</span>
            </span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.healthAlerts}
                onChange={(e) => update({ healthAlerts: e.target.checked })}
                disabled={!settings.notificationsEnabled}
                className="sr-only peer"
                aria-label="Enable health alerts"
              />
              <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
            </span>
          </label>
          <label className={`flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors ${settings.notificationsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <span>
              <span className="block text-sm font-medium">Email Alerts</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Email me when an alert fires</span>
            </span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings.emailAlerts}
                onChange={(e) => update({ emailAlerts: e.target.checked })}
                disabled={!settings.notificationsEnabled}
                className="sr-only peer"
                aria-label="Enable email alerts"
              />
              <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
            </span>
          </label>
          <div className="px-3 py-2.5">
            <div className="text-sm font-medium mb-2">Webhook Alerts</div>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              onBlur={() => {
                const next = webhookUrl.trim();
                if (next !== (settings.alertWebhookUrl ?? "")) void update({ alertWebhookUrl: next });
              }}
              placeholder="https://discord.com/api/webhooks/…"
              aria-label="Webhook URL"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
            <div className="flex items-center justify-between mt-3">
              <label className={`flex items-center ${settings.notificationsEnabled && isAuthenticated ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                <input
                  type="checkbox"
                  checked={!!settings.webhookAlerts}
                  onChange={(e) => void update({ webhookAlerts: e.target.checked })}
                  disabled={!settings.notificationsEnabled || !isAuthenticated}
                  className="mr-2"
                  aria-label="Enable webhook alerts"
                />
                <span className="text-sm">Enable webhooks</span>
              </label>
              <button
                type="button"
                disabled={webhookTesting || !isAuthenticated}
                onClick={handleTestWebhook}
                className="text-sm font-medium text-brand-600 dark:text-brand-400 disabled:opacity-50"
              >
                {webhookTesting ? "Sending…" : "Send test"}
              </button>
            </div>
            {webhookHint && (
              <p className={`mt-2 text-xs ${webhookHintOk ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {webhookHint}
              </p>
            )}
            {!isAuthenticated && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Sign in to use webhook alerts.
              </p>
            )}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Quiet Hours</p>
          <div className="flex gap-2 flex-wrap">
            {QUIET_HOURS_OPTIONS.map((option) => {
              const current = !settings.quietHours
                ? "Off"
                : `${settings.quietHours.start}–${settings.quietHours.end}`;
              return (
                <button
                  key={option}
                  onClick={() => {
                    if (option === "Off") {
                      update({ quietHours: undefined });
                    } else {
                      const [start, end] = option.split("–");
                      // Store only the window. `server-notifications.ts` stamps
                      // the device's current UTC offset when it uploads, so the
                      // server evaluates quiet hours in the user's timezone.
                      // Persisting the offset here synced a stale, possibly
                      // foreign (other-device) timezone into `settings`, which
                      // then mis-evaluated quiet hours locally.
                      update({ quietHours: { start, end } });
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    current === option
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                  aria-label={option === "Off" ? "Disable quiet hours" : `Set quiet hours to ${option}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {settings.quietHours && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Health alerts and digests are muted during quiet hours.
            </p>
          )}
        </div>
        <div className="mt-4 space-y-2">
          <Link
            to="/diagnostics"
            aria-label="Push delivery status"
            className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors"
          >
            <span>
              <span className="block text-sm font-medium">Push delivery status</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Check per-device delivery health</span>
            </span>
            <span className="text-brand-600 dark:text-brand-400 text-sm font-medium">View</span>
          </Link>
          <button
            onClick={handleTestNotification}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            aria-label="Send test notification"
          >
            Test Notification
          </button>
          {testNotifMessage && (<p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{testNotifMessage}</p>)}
        </div>
      </div>

  );
}
