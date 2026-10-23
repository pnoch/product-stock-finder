import {
  Text,
  View,
  TouchableOpacity,
  Switch,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SettingRow } from "@/components/settings/setting-row";
import { NotificationToggleRow } from "@/components/settings/notification-toggle-row";
import { WebhookSettings } from "@/components/settings/webhook-settings";
import { useNotificationWebhook } from "@/hooks/use-notification-webhook";
import { PillPicker } from "@/components/settings/pill-picker";
import { SectionHeader } from "@/components/settings/section-header";
import { setWebNotificationsEnabled } from "@/lib/web-notifications";
import type { AppSettings } from "@/lib/types";

export function NotificationsSection({
  settings,
  updateSetting,
  onTestNotification,
  webNotificationHint,
  setWebNotificationHint,
}: {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onTestNotification: () => void;
  webNotificationHint: string | null;
  setWebNotificationHint: (hint: string | null) => void;
}) {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const {
    webhookUrl,
    setWebhookUrl,
    testingWebhook,
    webhookHint,
    webhookHintOk,
    commitWebhookUrl,
    handleTestWebhook,
  } = useNotificationWebhook({ settings, updateSetting });

  return (
    <>
      <SectionHeader title="Notifications" />
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          marginHorizontal: 16,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        <NotificationToggleRow
          colors={colors}
          icon="bell.fill"
          label="Enable Notifications"
          description="Receive alerts on your device"
          value={settings.notificationsEnabled}
          onValueChange={(v) => updateSetting("notificationsEnabled", v)}
          accessibilityLabel="Enable notifications"
        />
        {Platform.OS === "web" && (
          <>
            <SettingRow
              icon="bell.badge.fill"
              label="Web Notifications"
              description="Show price and stock alerts in your browser"
              right={
                <Switch
                  value={!!settings.webNotificationsEnabled}
                  onValueChange={(v) => {
                    void setWebNotificationsEnabled(v).catch(() => "denied").then((permission) => {
                      const enabled = v && permission === "granted";
                      void updateSetting("webNotificationsEnabled", enabled);
                      if (v && permission !== "granted") {
                        setWebNotificationHint(
                          permission === "denied"
                            ? "Notifications are blocked in your browser settings."
                            : "Allow notifications in your browser to receive alerts.",
                        );
                      } else {
                        setWebNotificationHint(null);
                      }
                    });
                  }}
                  trackColor={{
                    false: colors.border,
                    true: colors.primary + "88",
                  }}
                  thumbColor={
                    settings.webNotificationsEnabled
                      ? colors.primary
                      : colors.muted
                  }
                  accessibilityLabel="Enable web notifications"
                  accessibilityRole="switch"
                />
              }
            />
            {webNotificationHint && (
              <Text
                style={{
                  color: colors.warning,
                  fontSize: 13,
                  paddingHorizontal: 16,
                  paddingBottom: 12,
                }}
              >
                {webNotificationHint}
              </Text>
            )}
          </>
        )}
        <NotificationToggleRow
          colors={colors}
          icon="checkmark.circle.fill"
          label="Stock Alerts"
          description="Notify when item comes in stock"
          value={settings.stockAlerts}
          onValueChange={(v) => updateSetting("stockAlerts", v)}
          accessibilityLabel="Enable stock alerts"
        />
        <NotificationToggleRow
          colors={colors}
          icon="tag.fill"
          label="Price Alerts"
          description="Notify when price drops below target"
          value={settings.priceAlerts}
          onValueChange={(v) => updateSetting("priceAlerts", v)}
          accessibilityLabel="Enable price alerts"
        />
        <NotificationToggleRow
          colors={colors}
          icon="exclamationmark.triangle.fill"
          label="Health Alerts"
          description="Notify when a distributor is blocked or down"
          value={settings.healthAlerts}
          onValueChange={(v) => updateSetting("healthAlerts", v)}
          accessibilityLabel="Enable health alerts"
        />
        <NotificationToggleRow
          colors={colors}
          icon="envelope.fill"
          label="Email Alerts"
          description="Email me when an alert fires"
          value={!!settings.emailAlerts}
          onValueChange={(v) => updateSetting("emailAlerts", v)}
          accessibilityLabel="Enable email alerts"
        />
        <WebhookSettings
          colors={colors}
          isAuthenticated={isAuthenticated}
          webhookUrl={webhookUrl}
          onWebhookUrl={setWebhookUrl}
          onCommit={commitWebhookUrl}
          webhookAlerts={!!settings.webhookAlerts}
          onWebhookAlerts={(v) => updateSetting("webhookAlerts", v)}
          testing={testingWebhook}
          onTest={() => void handleTestWebhook()}
          hint={webhookHint}
          hintOk={webhookHintOk}
        />
        <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
          <PillPicker
            icon="newspaper.fill"
            label="Price Digest"
            options={["Off", "Daily", "Weekly"]}
            value={
              settings.digestFrequency === "daily"
                ? "Daily"
                : settings.digestFrequency === "weekly"
                  ? "Weekly"
                  : "Off"
            }
            onSelect={(v) =>
              updateSetting(
                "digestFrequency",
                v === "Daily" ? "daily" : v === "Weekly" ? "weekly" : "off",
              )
            }
          />
          {settings.digestFrequency === "weekly" && (
            <PillPicker
              icon="calendar"
              label="Digest Day"
              options={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}
              value={
                ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                  settings.digestDayOfWeek ?? 0
                ]
              }
              onSelect={(v) =>
                updateSetting(
                  "digestDayOfWeek",
                  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(v),
                )
              }
            />
          )}
        </View>
        <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
          <PillPicker
            icon="moon.fill"
            label="Quiet Hours"
            options={["Off", "22:00–07:00", "23:00–07:00", "00:00–08:00"]}
            value={
              !settings.quietHours
                ? "Off"
                : `${settings.quietHours.start}–${settings.quietHours.end}`
            }
            onSelect={(v) => {
              if (v === "Off") updateSetting("quietHours", undefined);
              else {
                const [start, end] = v.split("–");
                updateSetting("quietHours", { start, end } as { start: string; end: string });
              }
            }}
          />
          {settings.quietHours && (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
              Health alerts and digests are muted during quiet hours.
            </Text>
          )}
        </View>
        {/* Test Notification — useful for verifying permissions on device */}
        <TouchableOpacity activeOpacity={0.7}
          onPress={onTestNotification}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 14,
            paddingHorizontal: 16,
          }}
          accessibilityLabel="Send test notification"
          accessibilityRole="button"
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: colors.success + "22",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <IconSymbol
              name="bell.badge.fill"
              size={18}
              color={colors.success}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "500",
                fontSize: 15,
              }}
            >
              Test Notification
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
              Send a test alert to verify setup
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7}
          onPress={() => router.push("/diagnostics")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 14,
            paddingHorizontal: 16,
          }}
          accessibilityLabel="Push delivery status"
          accessibilityRole="button"
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: colors.primary + "22",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <IconSymbol
              name="bell.badge.fill"
              size={18}
              color={colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "500",
                fontSize: 15,
              }}
            >
              Push delivery status
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
              Check per-device delivery health
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>
    </>
  );
}
