import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, Switch, Linking, Alert } from "react-native";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getSettings, saveSettings } from "@/lib/storage";
import { AppSettings } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { sendTestNotification } from "@/lib/notifications";

function SettingRow({ icon, label, description, right }: { icon: string; label: string; description?: string; right: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + "22", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
        <IconSymbol name={icon as any} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 15 }}>{label}</Text>
        {description && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>{description}</Text>}
      </View>
      {right}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
      {title}
    </Text>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const [settings, setSettings] = useState<AppSettings>({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
  });

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const updateSetting = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await saveSettings(updated);
  }, [settings]);

  const handleTestNotification = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const sent = await sendTestNotification();
    if (!sent) {
      Alert.alert(
        "Permission Required",
        "Please enable notifications in your device settings to receive stock and price alerts.",
        [{ text: "OK" }]
      );
    }
  }, []);

  const currencies = ["USD", "EUR", "GBP", "THB", "MYR", "AUD", "SGD", "ZAR"];
  const intervals = [
    { value: "manual", label: "Manual only" },
    { value: "hourly", label: "Every hour" },
    { value: "daily", label: "Once a day" },
  ];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-5 pt-4 pb-2">
          <Text className="text-2xl font-bold text-foreground">Settings</Text>
        </View>

        <SectionHeader title="Notifications" />
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, marginHorizontal: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          <SettingRow
            icon="bell.fill"
            label="Enable Notifications"
            description="Receive alerts on your device"
            right={
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={(v) => updateSetting("notificationsEnabled", v)}
                trackColor={{ false: colors.border, true: colors.primary + "88" }}
                thumbColor={settings.notificationsEnabled ? colors.primary : colors.muted}
              />
            }
          />
          <SettingRow
            icon="checkmark.circle.fill"
            label="Stock Alerts"
            description="Notify when item comes in stock"
            right={
              <Switch
                value={settings.stockAlerts}
                onValueChange={(v) => updateSetting("stockAlerts", v)}
                trackColor={{ false: colors.border, true: colors.primary + "88" }}
                thumbColor={settings.stockAlerts ? colors.primary : colors.muted}
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
                trackColor={{ false: colors.border, true: colors.primary + "88" }}
                thumbColor={settings.priceAlerts ? colors.primary : colors.muted}
              />
            }
          />
          {/* Test Notification — useful for verifying permissions on device */}
          <TouchableOpacity
            onPress={handleTestNotification}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.success + "22", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <IconSymbol name="bell.badge.fill" size={18} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 15 }}>Test Notification</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>Send a test alert to verify setup</Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <SectionHeader title="Display" />
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, marginHorizontal: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + "22", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <IconSymbol name="dollarsign.circle.fill" size={18} color={colors.primary} />
              </View>
              <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 15 }}>Display Currency</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingLeft: 48 }}>
              {currencies.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => updateSetting("displayCurrency", c)}
                  style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: settings.displayCurrency === c ? colors.primary : colors.border }}
                >
                  <Text style={{ color: settings.displayCurrency === c ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <SectionHeader title="Check Interval" />
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, marginHorizontal: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          {intervals.map((interval, idx) => (
            <TouchableOpacity
              key={interval.value}
              onPress={() => updateSetting("checkInterval", interval.value as AppSettings["checkInterval"])}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: idx < intervals.length - 1 ? 1 : 0, borderBottomColor: colors.border }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 15 }}>{interval.label}</Text>
              </View>
              {settings.checkInterval === interval.value && (
                <IconSymbol name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <SectionHeader title="About" />
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, marginHorizontal: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          <SettingRow
            icon="info.circle.fill"
            label="Version"
            description="Stock Tracker Pro"
            right={<Text style={{ color: colors.muted, fontSize: 14 }}>1.0.0</Text>}
          />
          <TouchableOpacity onPress={() => Linking.openURL("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")}>
            <SettingRow
              icon="eye.fill"
              label="Privacy Policy"
              right={<IconSymbol name="chevron.right" size={16} color={colors.muted} />}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL("mailto:support@stocktrackerpro.app")}>
            <SettingRow
              icon="paperplane.fill"
              label="Contact Support"
              right={<IconSymbol name="chevron.right" size={16} color={colors.muted} />}
            />
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: "center", marginTop: 32 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Stock Tracker Pro · v1.0.0</Text>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>Track smarter. Buy better.</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
