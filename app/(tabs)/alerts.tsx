import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  Switch,
  RefreshControl,
  Platform,
  Alert,
  Modal,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { NotificationCenter } from "@/components/notification-center";
import { useColors } from "@/hooks/use-colors";
import {
  getAlerts,
  removeAlert,
  toggleAlert,
  getWatchlist,
  getBackOrderReminders,
  removeBackOrderReminder,
  addBackOrderReminder,
  getStockWatches,
  removeStockWatch,
  rearmAlert,
  getUnreadNotificationCount,
} from "@/lib/storage";
import { PriceAlert, Product, BackOrderReminder } from "@/lib/types";
import { formatPrice, convertPrice } from "@/lib/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  cancelNotification,
  scheduleBackOrderReminder,
} from "@/lib/notifications";
import DateTimePicker from "@react-native-community/datetimepicker";

type ActiveTab = "alerts" | "reminders" | "notifications";

export default function AlertsScreen() {
  const router = useRouter();
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<ActiveTab>("alerts");
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [reminders, setReminders] = useState<BackOrderReminder[]>([]);
  const [stockWatches, setStockWatches] = useState<BackOrderReminder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Reschedule modal state
  const [rescheduleTarget, setRescheduleTarget] =
    useState<BackOrderReminder | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(new Date());
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);

  const loadData = useCallback(async () => {
    const [a, p, r, w, n] = await Promise.all([
      getAlerts(),
      getWatchlist(),
      getBackOrderReminders(),
      getStockWatches(),
      getUnreadNotificationCount(),
    ]);
    setAlerts(a);
    setProducts(p);
    setReminders(r);
    setStockWatches(w);
    setUnreadNotifications(n);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleToggle = useCallback(
    async (alertId: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await toggleAlert(alertId);
      await loadData();
    },
    [loadData],
  );

  const handleDeleteAlert = useCallback(
    async (alertId: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await removeAlert(alertId);
      await loadData();
    },
    [loadData],
  );

  const handleDeleteReminder = useCallback(
    async (reminder: BackOrderReminder) => {
      Alert.alert(
        "Cancel Reminder",
        `Cancel the reminder for ${reminder.productName} at ${reminder.distributorName}?`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Cancel Reminder",
            style: "destructive",
            onPress: async () => {
              if (Platform.OS !== "web")
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Warning,
                );
              if (reminder.notificationId) {
                await cancelNotification(reminder.notificationId);
              }
              await removeBackOrderReminder(reminder.id);
              await loadData();
            },
          },
        ],
      );
    },
    [loadData],
  );

  const handleRemoveStockWatch = useCallback(
    async (watch: BackOrderReminder) => {
      Alert.alert(
        "Remove Watch",
        `Stop watching ${watch.distributorName} for ${watch.productName}?`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              await removeStockWatch(watch.id);
              await loadData();
            },
          },
        ],
      );
    },
    [loadData],
  );

  const handleReschedule = useCallback(async () => {
    if (!rescheduleTarget) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (rescheduleTarget.notificationId) {
      await cancelNotification(rescheduleTarget.notificationId);
    }
    const notifId = await scheduleBackOrderReminder(
      rescheduleTarget.productName,
      rescheduleTarget.distributorName,
      rescheduleDate,
    );
    await addBackOrderReminder({
      ...rescheduleTarget,
      reminderDate: rescheduleDate.toISOString(),
      notificationId: notifId ?? undefined,
    });
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRescheduleTarget(null);
    setShowReschedulePicker(false);
    await loadData();
    Alert.alert(
      "Reminder Rescheduled ✅",
      `You'll be reminded on ${rescheduleDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.`,
    );
  }, [rescheduleTarget, rescheduleDate, loadData]);

  const getProductName = (productId: string) =>
    products.find((p) => p.id === productId)?.name ?? "Unknown Product";

  const triggeredAlerts = alerts.filter((a) => a.triggeredAt);

  const totalSaved = triggeredAlerts.reduce((sum, a) => {
    if (a.triggeredPrice != null) {
      // Normalize each alert's savings to USD so totals across currencies are meaningful
      const savedUsd = convertPrice(
        Math.max(0, a.targetPrice - a.triggeredPrice),
        a.currency,
        "USD",
      );
      return sum + savedUsd;
    }
    return sum;
  }, 0);

  const handleRearmAlert = useCallback(
    async (alertId: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await rearmAlert(alertId);
      await loadData();
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [loadData],
  );

  const tabCount = {
    alerts: alerts.length,
    reminders: reminders.length + stockWatches.length,
    notifications: unreadNotifications,
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: colors.foreground,
              fontSize: 24,
              fontWeight: "700",
            }}
          >
            Alerts & Reminders
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/restock-watches");
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: colors.primary,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
              Restock Watches
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
          {tabCount.alerts} active alert{tabCount.alerts !== 1 ? "s" : ""} ·{" "}
          {tabCount.reminders} reminder{tabCount.reminders !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Tab Switcher */}
      <View
        style={{
          flexDirection: "row",
          marginHorizontal: 20,
          marginBottom: 12,
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 4,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {(["alerts", "reminders", "notifications"] as ActiveTab[]).map(
          (tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => {
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                backgroundColor:
                  activeTab === tab ? colors.primary : "transparent",
              }}
            >
              <IconSymbol
                name={
                  tab === "alerts"
                    ? "bell.fill"
                    : tab === "reminders"
                      ? "calendar"
                      : "bell.badge.fill"
                }
                size={15}
                color={activeTab === tab ? "#fff" : colors.muted}
              />
              <Text
                style={{
                  color: activeTab === tab ? "#fff" : colors.muted,
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                {tab === "alerts"
                  ? "Alerts"
                  : tab === "reminders"
                    ? "Reminders"
                    : "Notifications"}
                {tabCount[tab] > 0 ? ` (${tabCount[tab]})` : ""}
              </Text>
            </TouchableOpacity>
          ),
        )}
      </View>

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 24,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            alerts.length > 0 ? (
              <View
                style={{
                  backgroundColor: colors.primary + "15",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <IconSymbol
                  name="info.circle.fill"
                  size={18}
                  color={colors.primary}
                />
                <Text style={{ color: colors.primary, fontSize: 13, flex: 1 }}>
                  You&apos;ll be notified when a product&apos;s price drops
                  below your target.
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            triggeredAlerts.length > 0 ? (
              <View style={{ marginTop: 24 }}>
                {/* Savings Calculator Banner */}
                {totalSaved > 0 && (
                  <View
                    style={{
                      backgroundColor: colors.success + "18",
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      borderWidth: 1,
                      borderColor: colors.success + "44",
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>🎉</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.success,
                          fontWeight: "700",
                          fontSize: 15,
                        }}
                      >
                        Total Saved: {formatPrice(totalSaved, "USD")}
                      </Text>
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        Across{" "}
                        {
                          triggeredAlerts.filter(
                            (a) => a.triggeredPrice != null,
                          ).length
                        }{" "}
                        triggered alert
                        {triggeredAlerts.filter((a) => a.triggeredPrice != null)
                          .length !== 1
                          ? "s"
                          : ""}
                      </Text>
                    </View>
                  </View>
                )}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  <IconSymbol
                    name="checkmark.circle.fill"
                    size={16}
                    color={colors.success}
                  />
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "700",
                      fontSize: 15,
                    }}
                  >
                    Price Drop History ({triggeredAlerts.length})
                  </Text>
                </View>
                {triggeredAlerts.map((item) => (
                  <View
                    key={item.id}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: colors.success + "44",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text
                          style={{
                            color: colors.foreground,
                            fontWeight: "600",
                            fontSize: 14,
                          }}
                          numberOfLines={2}
                        >
                          {getProductName(item.productId)}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginTop: 5,
                            gap: 5,
                          }}
                        >
                          <IconSymbol
                            name="tag.fill"
                            size={13}
                            color={colors.muted}
                          />
                          <Text style={{ color: colors.muted, fontSize: 13 }}>
                            Target:{" "}
                            {formatPrice(item.targetPrice, item.currency)}
                          </Text>
                          {item.triggeredPrice != null && (
                            <Text
                              style={{
                                color: colors.success,
                                fontSize: 13,
                                fontWeight: "600",
                              }}
                            >
                              →{" "}
                              {formatPrice(item.triggeredPrice, item.currency)}
                            </Text>
                          )}
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginTop: 4,
                            gap: 5,
                          }}
                        >
                          <IconSymbol
                            name="checkmark.circle.fill"
                            size={13}
                            color={colors.success}
                          />
                          <Text style={{ color: colors.success, fontSize: 12 }}>
                            Triggered{" "}
                            {new Date(item.triggeredAt!).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => handleRearmAlert(item.id)}
                          style={{
                            backgroundColor: colors.primary + "18",
                            borderRadius: 8,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <IconSymbol
                            name="arrow.clockwise"
                            size={12}
                            color={colors.primary}
                          />
                          <Text
                            style={{
                              color: colors.primary,
                              fontSize: 12,
                              fontWeight: "600",
                            }}
                          >
                            Watch Again
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteAlert(item.id)}
                          style={{ padding: 4 }}
                        >
                          <IconSymbol
                            name="trash.fill"
                            size={15}
                            color={colors.muted}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 60,
              }}
            >
              <IconSymbol name="bell.fill" size={48} color={colors.muted} />
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "600",
                  fontSize: 18,
                  marginTop: 16,
                }}
              >
                No alerts set
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 14,
                  textAlign: "center",
                  marginTop: 8,
                }}
              >
                Open a product and tap &quot;Set Alert&quot; to get notified
                when the price drops.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: item.triggeredAt
                  ? colors.success + "44"
                  : colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "600",
                      fontSize: 14,
                    }}
                    numberOfLines={2}
                  >
                    {getProductName(item.productId)}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 6,
                      gap: 6,
                    }}
                  >
                    <IconSymbol
                      name="tag.fill"
                      size={14}
                      color={colors.muted}
                    />
                    <Text style={{ color: colors.muted, fontSize: 13 }}>
                      Target: {formatPrice(item.targetPrice, item.currency)}
                    </Text>
                  </View>
                  {item.triggeredAt && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 4,
                        gap: 6,
                      }}
                    >
                      <IconSymbol
                        name="checkmark.circle.fill"
                        size={14}
                        color={colors.success}
                      />
                      <Text style={{ color: colors.success, fontSize: 12 }}>
                        Triggered{" "}
                        {new Date(item.triggeredAt).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  {!item.triggeredAt && (
                    <Switch
                      value={item.isActive}
                      onValueChange={() => handleToggle(item.id)}
                      trackColor={{
                        false: colors.border,
                        true: colors.primary + "88",
                      }}
                      thumbColor={item.isActive ? colors.primary : colors.muted}
                    />
                  )}
                  <TouchableOpacity
                    onPress={() => handleDeleteAlert(item.id)}
                    style={{ padding: 4 }}
                  >
                    <IconSymbol
                      name="trash.fill"
                      size={16}
                      color={colors.error}
                    />
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
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 24,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <View>
              {/* Stock Watches section */}
              {stockWatches.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 10,
                    }}
                  >
                    <IconSymbol
                      name="eye.fill"
                      size={15}
                      color={colors.warning}
                    />
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      Watching for Restock ({stockWatches.length})
                    </Text>
                  </View>
                  {stockWatches.map((watch) => (
                    <View
                      key={watch.id}
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: 16,
                        padding: 14,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: colors.warning + "44",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text
                            style={{
                              color: colors.foreground,
                              fontWeight: "600",
                              fontSize: 14,
                            }}
                            numberOfLines={2}
                          >
                            {watch.productName}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginTop: 5,
                              gap: 5,
                            }}
                          >
                            <IconSymbol
                              name="globe"
                              size={13}
                              color={colors.muted}
                            />
                            <Text style={{ color: colors.muted, fontSize: 13 }}>
                              {watch.distributorName}
                            </Text>
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginTop: 4,
                              gap: 5,
                            }}
                          >
                            <View
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor:
                                  watch.lastKnownStatus === "in_stock"
                                    ? colors.success
                                    : colors.warning,
                              }}
                            />
                            <Text style={{ color: colors.muted, fontSize: 12 }}>
                              {watch.lastKnownStatus === "back_order"
                                ? "Back Order"
                                : watch.lastKnownStatus === "out_of_stock"
                                  ? "Out of Stock"
                                  : watch.lastKnownStatus === "in_stock"
                                    ? "In Stock"
                                    : "Unknown"}
                            </Text>
                            <Text
                              style={{
                                color: colors.muted,
                                fontSize: 12,
                                opacity: 0.6,
                              }}
                            >
                              · last checked
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 8 }}>
                          <View
                            style={{
                              backgroundColor: colors.warning + "22",
                              borderRadius: 8,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                            }}
                          >
                            <Text
                              style={{
                                color: colors.warning,
                                fontSize: 11,
                                fontWeight: "600",
                              }}
                            >
                              👀 Watching
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleRemoveStockWatch(watch)}
                            style={{ padding: 4 }}
                          >
                            <IconSymbol
                              name="trash.fill"
                              size={16}
                              color={colors.error}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
              {/* Date Reminders header (only if both sections present) */}
              {stockWatches.length > 0 && reminders.length > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  <IconSymbol
                    name="calendar"
                    size={15}
                    color={colors.primary}
                  />
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "700",
                      fontSize: 14,
                    }}
                  >
                    Date Reminders ({reminders.length})
                  </Text>
                </View>
              )}
              {/* Empty state when both lists are empty */}
              {stockWatches.length === 0 && reminders.length === 0 && (
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    paddingTop: 60,
                  }}
                >
                  <IconSymbol name="calendar" size={48} color={colors.muted} />
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "600",
                      fontSize: 18,
                      marginTop: 16,
                    }}
                  >
                    No reminders set
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 14,
                      textAlign: "center",
                      marginTop: 8,
                      paddingHorizontal: 20,
                    }}
                  >
                    Open a back-order product listing and tap &quot;Remind
                    me&quot; or &quot;Watch for Restock&quot;.
                  </Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const reminderDate = new Date(item.reminderDate);
            const isPast = reminderDate < new Date();
            return (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: isPast ? colors.warning + "44" : colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: "600",
                        fontSize: 14,
                      }}
                      numberOfLines={2}
                    >
                      {item.productName}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 5,
                        gap: 5,
                      }}
                    >
                      <IconSymbol name="globe" size={13} color={colors.muted} />
                      <Text style={{ color: colors.muted, fontSize: 13 }}>
                        {item.distributorName}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 4,
                        gap: 5,
                      }}
                    >
                      <IconSymbol
                        name="calendar"
                        size={13}
                        color={isPast ? colors.warning : colors.primary}
                      />
                      <Text
                        style={{
                          color: isPast ? colors.warning : colors.primary,
                          fontSize: 13,
                          fontWeight: "500",
                        }}
                      >
                        {isPast ? "Was due " : "Remind on "}
                        {reminderDate.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 8 }}>
                    {isPast && (
                      <View
                        style={{
                          backgroundColor: colors.warning + "22",
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.warning,
                            fontSize: 11,
                            fontWeight: "600",
                          }}
                        >
                          Past Due
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        if (Platform.OS !== "web")
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                        const nextWeek = new Date();
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        setRescheduleDate(nextWeek);
                        setShowReschedulePicker(false);
                        setRescheduleTarget(item);
                      }}
                      style={{ padding: 4 }}
                    >
                      <IconSymbol
                        name="pencil"
                        size={16}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteReminder(item)}
                      style={{ padding: 4 }}
                    >
                      <IconSymbol
                        name="trash.fill"
                        size={16}
                        color={colors.error}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <NotificationCenter onUnreadChange={setUnreadNotifications} />
      )}

      {/* Reschedule Reminder Modal */}
      <Modal
        visible={!!rescheduleTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setRescheduleTarget(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 20,
                fontWeight: "700",
                marginBottom: 4,
              }}
            >
              Reschedule Reminder 📅
            </Text>
            <Text
              style={{ color: colors.muted, fontSize: 14, marginBottom: 20 }}
            >
              Choose a new date for{" "}
              <Text style={{ fontWeight: "600", color: colors.foreground }}>
                {rescheduleTarget?.distributorName}
              </Text>{" "}
              · {rescheduleTarget?.productName}
            </Text>
            <TouchableOpacity
              onPress={() => setShowReschedulePicker(true)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <IconSymbol name="calendar" size={20} color={colors.primary} />
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 17,
                    fontWeight: "600",
                  }}
                >
                  {rescheduleDate.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </TouchableOpacity>
            {showReschedulePicker && (
              <DateTimePicker
                value={rescheduleDate}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                minimumDate={new Date()}
                onChange={(_, selected) => {
                  setShowReschedulePicker(Platform.OS === "ios");
                  if (selected) setRescheduleDate(selected);
                }}
              />
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setRescheduleTarget(null);
                  setShowReschedulePicker(false);
                }}
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReschedule}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  Reschedule
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
