import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { NotificationCenter } from "@/components/notification-center";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@/lib/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAlertsData } from "@/hooks/use-alerts-data";

import { TabSwitcher } from "@/components/alerts/tab-switcher";
import { AlertCard } from "@/components/alerts/alert-card";
import { TriggeredAlertCard } from "@/components/alerts/triggered-alert-card";
import { StockWatchCard } from "@/components/alerts/stock-watch-card";
import { ReminderCard } from "@/components/alerts/reminder-card";
import { RescheduleModal } from "@/components/alerts/reschedule-modal";

export default function AlertsScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    activeTab, setActiveTab,
    alerts, reminders, stockWatches,
    refreshing, onRefresh,
    setUnreadNotifications,
    handleToggle, handleDeleteAlert, handleDeleteReminder,
    handleRemoveStockWatch, handleReschedule, handleRearmAlert,
    getProductName, triggeredAlerts, totalSaved, tabCount,
    rescheduleTarget, setRescheduleTarget,
    rescheduleDate, setRescheduleDate,
    showReschedulePicker, setShowReschedulePicker,
  } = useAlertsData();

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
      <TabSwitcher active={activeTab} counts={tabCount} onChange={setActiveTab} />

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
                  <TriggeredAlertCard
                    key={item.id}
                    alert={item}
                    productName={getProductName(item.productId)}
                    onRearm={handleRearmAlert}
                    onDelete={handleDeleteAlert}
                  />
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
            <AlertCard
              alert={item}
              productName={getProductName(item.productId)}
              onToggle={handleToggle}
              onDelete={handleDeleteAlert}
            />
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
                    <StockWatchCard
                      key={watch.id}
                      watch={watch}
                      onDelete={handleRemoveStockWatch}
                    />
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
          renderItem={({ item }) => (
            <ReminderCard
              reminder={item}
              onReschedule={(r) => {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                setRescheduleDate(nextWeek);
                setShowReschedulePicker(false);
                setRescheduleTarget(r);
              }}
              onDelete={handleDeleteReminder}
            />
          )}
        />
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <NotificationCenter onUnreadChange={setUnreadNotifications} />
      )}

      {/* Reschedule Reminder Modal */}
      <RescheduleModal
        visible={!!rescheduleTarget}
        target={rescheduleTarget}
        date={rescheduleDate}
        showPicker={showReschedulePicker}
        onDateChange={setRescheduleDate}
        onShowPicker={setShowReschedulePicker}
        onConfirm={handleReschedule}
        onCancel={() => {
          setRescheduleTarget(null);
          setShowReschedulePicker(false);
        }}
      />
    </ScreenContainer>
  );
}
