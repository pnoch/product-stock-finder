import {
  Text,
  View,
  TouchableOpacity,
  Switch,
  Platform,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SettingRow } from "@/components/settings/setting-row";
import { PillPicker } from "@/components/settings/pill-picker";
import { SectionHeader } from "@/components/settings/section-header";
import { setWebNotificationsEnabled } from "@/lib/web-notifications";
import type { AppSettings } from "@/lib/types";

export function NotificationsSection({
  settings,
  updateSetting,
  onTestNotification,
  setSettings,
  webNotificationHint,
  setWebNotificationHint,
}: {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onTestNotification: () => void;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  webNotificationHint: string | null;
  setWebNotificationHint: (hint: string | null) => void;
}) {
  const colors = useColors();

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
        <SettingRow
          icon="bell.fill"
          label="Enable Notifications"
          description="Receive alerts on your device"
          right={
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(v) => updateSetting("notificationsEnabled", v)}
              trackColor={{
                false: colors.border,
                true: colors.primary + "88",
              }}
              thumbColor={
                settings.notificationsEnabled ? colors.primary : colors.muted
              }
              accessibilityLabel="Enable notifications"
              accessibilityRole="switch"
            />
          }
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
                      setSettings((prev) => ({
                        ...prev,
                        webNotificationsEnabled: enabled,
                      }));
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
        <SettingRow
          icon="checkmark.circle.fill"
          label="Stock Alerts"
          description="Notify when item comes in stock"
          right={
            <Switch
              value={settings.stockAlerts}
              onValueChange={(v) => updateSetting("stockAlerts", v)}
              trackColor={{
                false: colors.border,
                true: colors.primary + "88",
              }}
              thumbColor={
                settings.stockAlerts ? colors.primary : colors.muted
              }
              accessibilityLabel="Enable stock alerts"
              accessibilityRole="switch"
            />
          }
        />
        <SettingRow
          icon="tag.fill"
          label="Price Alerts"
          description="Notify when price drops below target"
          right={
            <Switch
              value={settings.priceAlerts}
              onValueChange={(v) => updateSetting("priceAlerts", v)}
              trackColor={{
                false: colors.border,
                true: colors.primary + "88",
              }}
              thumbColor={
                settings.priceAlerts ? colors.primary : colors.muted
              }
              accessibilityLabel="Enable price alerts"
              accessibilityRole="switch"
            />
          }
        />
        <SettingRow
          icon="exclamationmark.triangle.fill"
          label="Health Alerts"
          description="Notify when a distributor is blocked or down"
          right={
            <Switch
              value={settings.healthAlerts}
              onValueChange={(v) => updateSetting("healthAlerts", v)}
              trackColor={{
                false: colors.border,
                true: colors.primary + "88",
              }}
              thumbColor={
                settings.healthAlerts ? colors.primary : colors.muted
              }
              accessibilityLabel="Enable health alerts"
              accessibilityRole="switch"
            />
          }
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
      </View>
    </>
  );
}
