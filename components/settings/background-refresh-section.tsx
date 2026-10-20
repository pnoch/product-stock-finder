import { Pressable, Switch, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SettingRow } from "@/components/settings/setting-row";
import { shouldEnforceFreeLimits } from "@/lib/pro-features";
import { applyBackgroundServiceToggle } from "@/lib/background-service-toggle";
import { formatLastRefreshed } from "@/lib/last-refreshed";
import type { AppSettings } from "@/lib/types";
import type { MonitoringHealth } from "@/lib/monitoring-health";

export function BackgroundRefreshSection({
  settings,
  updateSetting,
  isPro,
  openPaywall,
  monitoring,
  onReenableMonitoring,
}: {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => Promise<void>;
  isPro: boolean;
  openPaywall: () => void;
  monitoring: MonitoringHealth;
  onReenableMonitoring: () => void;
}) {
  const colors = useColors();
  const locked = shouldEnforceFreeLimits() && !isPro;

  return (
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
      <Pressable
        onPress={locked ? openPaywall : undefined}
        disabled={locked}
        accessibilityLabel={
          locked
            ? "Background refresh requires Pro. Tap to upgrade."
            : "Background refresh"
        }
        accessibilityRole={locked ? "button" : undefined}
      >
        <SettingRow
          icon="arrow.clockwise"
          label="Background refresh"
          description={
            "Keeps checking prices while the app is closed (shows a persistent notification)." +
            (locked ? " (Pro)" : "")
          }
          right={
            <Switch
              value={!locked && !!settings.backgroundServiceEnabled}
              disabled={locked}
              onValueChange={(value) => {
                if (locked) return;
                void updateSetting("backgroundServiceEnabled", value);
                void applyBackgroundServiceToggle(value);
              }}
              trackColor={{
                false: colors.border,
                true: colors.primary + "88",
              }}
              thumbColor={
                settings.backgroundServiceEnabled
                  ? colors.primary
                  : colors.muted
              }
              accessibilityLabel="Enable background refresh"
              accessibilityRole="switch"
            />
          }
        />
      </Pressable>
      {monitoring.status === "ok" && (
        <View
          style={{
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {monitoring.lastRunAt != null
              ? `Last checked: ${formatLastRefreshed(
                  new Date(monitoring.lastRunAt).toISOString(),
                )}`
              : "Not yet run"}
          </Text>
        </View>
      )}
      {(monitoring.status === "stopped" || monitoring.status === "stale") && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={18}
            color={colors.warning}
          />
          <Text style={{ flex: 1, color: colors.foreground, fontSize: 13 }}>
            Background monitoring may have stopped
          </Text>
          <Pressable
            onPress={onReenableMonitoring}
            accessibilityLabel="Re-enable background monitoring"
            accessibilityRole="button"
            style={{
              backgroundColor: colors.warning + "22",
              borderRadius: 10,
              paddingVertical: 6,
              paddingHorizontal: 12,
            }}
          >
            <Text
              style={{
                color: colors.warning,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              Re-enable
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
