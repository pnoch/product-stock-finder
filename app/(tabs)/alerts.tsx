import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, View, TouchableOpacity, Switch, RefreshControl, Platform, Alert } from "react-native";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getAlerts,
  removeAlert,
  toggleAlert,
  getWatchlist,
  getBackOrderReminders,
  removeBackOrderReminder,
} from "@/lib/storage";
import { PriceAlert, Product, BackOrderReminder } from "@/lib/types";
import { formatPrice } from "@/lib/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { cancelNotification } from "@/lib/notifications";

type ActiveTab = "alerts" | "reminders";

export default function AlertsScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<ActiveTab>("alerts");
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [reminders, setReminders] = useState<BackOrderReminder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [a, p, r] = await Promise.all([getAlerts(), getWatchlist(), getBackOrderReminders()]);
    setAlerts(a);
    setProducts(p);
    setReminders(r);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleToggle = useCallback(async (alertId: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await toggleAlert(alertId);
    await loadData();
  }, [loadData]);

  const handleDeleteAlert = useCallback(async (alertId: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await removeAlert(alertId);
    await loadData();
  }, [loadData]);

  const handleDeleteReminder = useCallback(async (reminder: BackOrderReminder) => {
    Alert.alert(
      "Cancel Reminder",
      `Cancel the reminder for ${reminder.productName} at ${reminder.distributorName}?`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel Reminder",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            if (reminder.notificationId) {
              await cancelNotification(reminder.notificationId);
            }
            await removeBackOrderReminder(reminder.id);
            await loadData();
          },
        },
      ]
    );
  }, [loadData]);

  const getProductName = (productId: string) =>
    products.find((p) => p.id === productId)?.name ?? "Unknown Product";

  const activeAlerts = alerts.filter((a) => a.isActive && !a.triggeredAt);
  const triggeredAlerts = alerts.filter((a) => a.triggeredAt);

  const tabCount = {
    alerts: activeAlerts.length,
    reminders: reminders.length,
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700" }}>Alerts & Reminders</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
          {tabCount.alerts} active alert{tabCount.alerts !== 1 ? "s" : ""} · {tabCount.reminders} reminder{tabCount.reminders !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Tab Switcher */}
      <View style={{ flexDirection: "row", marginHorizontal: 20, marginBottom: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.border }}>
        {(["alerts", "reminders"] as ActiveTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(tab);
            }}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 9,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 6,
              backgroundColor: activeTab === tab ? colors.primary : "transparent",
            }}
          >
            <IconSymbol
              name={tab === "alerts" ? "bell.fill" : "calendar"}
              size={15}
              color={activeTab === tab ? "#fff" : colors.muted}
            />
            <Text style={{ color: activeTab === tab ? "#fff" : colors.muted, fontWeight: "600", fontSize: 14 }}>
              {tab === "alerts" ? "Alerts" : "Reminders"}
              {tabCount[tab] > 0 ? ` (${tabCount[tab]})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            alerts.length > 0 ? (
              <View style={{ backgroundColor: colors.primary + "15", borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <IconSymbol name="info.circle.fill" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13, flex: 1 }}>
                  You'll be notified when a product's price drops below your target.
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
              <IconSymbol name="bell.fill" size={48} color={colors.muted} />
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 18, marginTop: 16 }}>No alerts set</Text>
              <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 8 }}>
                Open a product and tap "Set Alert" to get notified when the price drops.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: item.triggeredAt ? colors.success + "44" : colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }} numberOfLines={2}>
                    {getProductName(item.productId)}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 }}>
                    <IconSymbol name="tag.fill" size={14} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 13 }}>
                      Target: {formatPrice(item.targetPrice, item.currency)}
                    </Text>
                  </View>
                  {item.triggeredAt && (
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 }}>
                      <IconSymbol name="checkmark.circle.fill" size={14} color={colors.success} />
                      <Text style={{ color: colors.success, fontSize: 12 }}>
                        Triggered {new Date(item.triggeredAt).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  {!item.triggeredAt && (
                    <Switch
                      value={item.isActive}
                      onValueChange={() => handleToggle(item.id)}
                      trackColor={{ false: colors.border, true: colors.primary + "88" }}
                      thumbColor={item.isActive ? colors.primary : colors.muted}
                    />
                  )}
                  <TouchableOpacity onPress={() => handleDeleteAlert(item.id)} style={{ padding: 4 }}>
                    <IconSymbol name="trash.fill" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Reminders Tab */}
      {activeTab === "reminders" && (
        <FlatList
          data={reminders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
              <IconSymbol name="calendar" size={48} color={colors.muted} />
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 18, marginTop: 16 }}>No reminders set</Text>
              <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 8, paddingHorizontal: 20 }}>
                Open a back-order product listing and tap "Remind me" to schedule a reminder.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const reminderDate = new Date(item.reminderDate);
            const isPast = reminderDate < new Date();
            return (
              <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: isPast ? colors.warning + "44" : colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }} numberOfLines={2}>
                      {item.productName}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 5, gap: 5 }}>
                      <IconSymbol name="globe" size={13} color={colors.muted} />
                      <Text style={{ color: colors.muted, fontSize: 13 }}>{item.distributorName}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 5 }}>
                      <IconSymbol name="calendar" size={13} color={isPast ? colors.warning : colors.primary} />
                      <Text style={{ color: isPast ? colors.warning : colors.primary, fontSize: 13, fontWeight: "500" }}>
                        {isPast ? "Was due " : "Remind on "}
                        {reminderDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 8 }}>
                    {isPast && (
                      <View style={{ backgroundColor: colors.warning + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: colors.warning, fontSize: 11, fontWeight: "600" }}>Past Due</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => handleDeleteReminder(item)}
                      style={{ padding: 4 }}
                    >
                      <IconSymbol name="trash.fill" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}
