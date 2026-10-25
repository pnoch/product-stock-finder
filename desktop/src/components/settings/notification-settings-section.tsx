import { useCallback, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router";
import type { AppSettings } from "../../../../lib/types";
import { SettingsToggleRow } from "./SettingsToggleRow";
import { usePushNotifications } from "../../hooks/use-push-notifications";
import { useAlertWebhook } from "../../hooks/use-alert-webhook";

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

  const handleTestNotification = useCallback(async () => {
    const { sendDesktopNotification } = await import("../../notifications");
    const shown = await sendDesktopNotification(
      "Notifications working",
      "OmniShop will alert you here.",
    );
    setTestNotifMessage(
      shown ? "Test notification sent" : "Notification permission not granted",
    );
  }, []);

  const {
    effectivePushState,
    pushBusy,
    pushReason,
    webNotifHint,
    handleEnablePush,
    handleDisablePush,
    handleWebToggle,
  } = usePushNotifications({ isAuthenticated, update, showToast });

  const {
    webhookUrl,
    setWebhookUrl,
    webhookHint,
    webhookHintOk,
    webhookTesting,
    handleTestWebhook,
    saveWebhookUrl,
  } = useAlertWebhook({ settings, update });

  return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Notifications</h2>
        </div>
        <div className="space-y-1">
          <SettingsToggleRow
            label="Enable Notifications"
            description="Receive alerts on your device"
            checked={settings.notificationsEnabled}
            onChange={(checked) => update({ notificationsEnabled: checked })}
            ariaLabel="Enable notifications"
          />
          <SettingsToggleRow
            label="Stock Alerts"
            description="Notify when item comes in stock"
            checked={settings.stockAlerts}
            onChange={(checked) => update({ stockAlerts: checked })}
            disabled={!settings.notificationsEnabled}
            ariaLabel="Enable stock alerts"
          />
          <SettingsToggleRow
            label="Price Alerts"
            description="Notify when price drops below target"
            checked={settings.priceAlerts}
            onChange={(checked) => update({ priceAlerts: checked })}
            disabled={!settings.notificationsEnabled}
            ariaLabel="Enable price alerts"
          />
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
          <SettingsToggleRow
            label="Web Notifications"
            description="Show price and stock alerts in your browser"
            checked={!!settings.webNotificationsEnabled}
            onChange={(checked) => void handleWebToggle(checked)}
            ariaLabel="Enable web notifications"
          />
          {webNotifHint && (
            <p className="px-3 text-xs text-amber-600 dark:text-amber-400">{webNotifHint}</p>
          )}
          <SettingsToggleRow
            label="Health Alerts"
            description="Notify when a distributor is blocked or down"
            checked={settings.healthAlerts}
            onChange={(checked) => update({ healthAlerts: checked })}
            disabled={!settings.notificationsEnabled}
            ariaLabel="Enable health alerts"
          />
          <SettingsToggleRow
            label="Email Alerts"
            description="Email me when an alert fires"
            checked={!!settings.emailAlerts}
            onChange={(checked) => update({ emailAlerts: checked })}
            disabled={!settings.notificationsEnabled}
            ariaLabel="Enable email alerts"
          />
          <div className="px-3 py-2.5">
            <div className="text-sm font-medium mb-2">Webhook Alerts</div>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              onBlur={saveWebhookUrl}
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
