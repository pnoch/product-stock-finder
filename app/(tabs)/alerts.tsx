import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Animated,
} from "react-native";
import { useCallback, useState, useRef } from "react";
import type { PriceAlert } from "@/lib/types";
import { PriceAlertModal } from "@/components/product/price-alert-modal";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { NotificationCenter } from "@/components/notification-center";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@/lib/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAlertsData } from "@/hooks/use-alerts-data";
import { showAlert } from "@/lib/alert";
import { getDistributorById } from "@/lib/distributors";

import { TabSwitcher } from "@/components/alerts/tab-switcher";
import { AlertCard } from "@/components/alerts/alert-card";
import { TriggeredAlertCard } from "@/components/alerts/triggered-alert-card";
import { StockWatchCard } from "@/components/alerts/stock-watch-card";
import { ReminderCard } from "@/components/alerts/reminder-card";
import { RescheduleModal } from "@/components/alerts/reschedule-modal";
import { SkeletonList } from "@/components/ui/skeleton";

export default function AlertsScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    activeTab, setActiveTab,
    alerts, reminders, stockWatches,
    products,
    refreshing, loading, onRefresh,
    setUnreadNotifications,
    handleToggle, handleDeleteAlert, handleDeleteReminder,
    handleSnoozeAlert, handleUpdateAlert,
    handleRemoveStockWatch, handleReschedule, handleRearmAlert,
    getProductName, triggeredAlerts, totalSaved, tabCount,
    rescheduleTarget, setRescheduleTarget,
    rescheduleDate, setRescheduleDate,
    showReschedulePicker, setShowReschedulePicker,
  } = useAlertsData();

  const fabScale = useRef(new Animated.Value(1)).current;
  const handleFabPressIn = useCallback(() => {
    Animated.spring(fabScale, { toValue: 0.92, useNativeDriver: true, speed: 50, bounciness: 6 }).start();
  }, [fabScale]);
  const handleFabPressOut = useCallback(() => {
    Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  }, [fabScale]);
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editCurrency, setEditCurrency] = useState("USD");
  const [editDirection, setEditDirection] = useState<"drop" | "rise">("drop");
  const [editDistributorId, setEditDistributorId] = useState<string | null>(
    null,
  );

  const handleEditAlert = useCallback(
    (alertId: string) => {
      const alert = alerts.find((a) => a.id === alertId);
      if (!alert) return;
      setEditingAlert(alert);
      setEditPrice(String(alert.targetPrice));
      setEditCurrency(alert.currency);
      setEditDirection(alert.direction ?? "drop");
      setEditDistributorId(alert.distributorId ?? null);
    },
    [alerts],
  );

  const editDistributors = editingAlert
    ? products
        .find((p) => p.id === editingAlert.productId)
        ?.listings.map((l) => {
          const d = getDistributorById(l.distributorId);
          return {
            id: l.distributorId,
            name: d?.name ?? l.distributorId,
            countryFlag: d?.countryFlag ?? "",
          };
        }) ?? []
    : [];

  if (loading) {
    return (
      <ScreenContainer>
        <SkeletonList count={4} />
      </ScreenContainer>
    );
  }

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
          <TouchableOpacity activeOpacity={0.85}
            accessibilityLabel="Restock Watches"
            accessibilityRole="button"
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary + "14", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <IconSymbol name="bell.fill" size={12} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>{tabCount.alerts} alerts</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.warning + "14", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <IconSymbol name="calendar" size={12} color={colors.warning} />
            <Text style={{ color: colors.warning, fontSize: 12, fontWeight: "700" }}>{tabCount.reminders} reminders</Text>
          </View>
        </View>
      </View>

      {/* Tab Switcher */}
      <TabSwitcher active={activeTab} counts={tabCount} onChange={setActiveTab} />

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <FlatList showsVerticalScrollIndicator={true}
          data={alerts}
          keyExtractor={(item) => item.id}
          initialNumToRender={8}
          windowSize={5}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
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
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
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
            alerts.length === 0 && triggeredAlerts.length === 0
              ? null
              : triggeredAlerts.length > 0 ? (
              <View style={{ marginTop: 20 }}>
                <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 16, marginTop: 4 }} />
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
              onSnooze={handleSnoozeAlert}
              onEdit={handleEditAlert}
            />
          )}
        />
      )}

      {/* Reminders Tab */}
      {activeTab === "reminders" && (
        <FlatList showsVerticalScrollIndicator={true}
          data={reminders}
          keyExtractor={(item) => item.id}
          initialNumToRender={8}
          windowSize={5}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
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
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
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
                setRescheduleDate(new Date(r.reminderDate));
                setShowReschedulePicker(true);
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

      {activeTab !== "notifications" && (
        <Animated.View
          style={{
            position: "absolute",
            bottom: 24,
            right: 20,
            transform: [{ scale: fabScale }],
          }}
        >
          <TouchableOpacity activeOpacity={0.85}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/search");
            }}
            onPressIn={handleFabPressIn}
            onPressOut={handleFabPressOut}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.primary,
              shadowOpacity: 0.35,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
            accessibilityLabel="Add product"
            accessibilityRole="button"
          >
            <IconSymbol name="plus" size={26} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      <PriceAlertModal
        visible={!!editingAlert}
        editingAlertId={editingAlert?.id}
        onClose={() => setEditingAlert(null)}
        onSetAlert={async () => {
          if (!editingAlert) return;
          const price = parseFloat(editPrice);
          if (isNaN(price) || price <= 0) {
            showAlert("Invalid Price", "Please enter a valid target price.");
            return;
          }
          await handleUpdateAlert(editingAlert.id, {
            targetPrice: price,
            currency: editCurrency,
            direction: editDirection,
            distributorId: editDistributorId,
          });
          setEditingAlert(null);
          showAlert("Alert Updated", "Your changes have been saved.");
        }}
        alertPrice={editPrice}
        setAlertPrice={setEditPrice}
        alertCurrency={editCurrency}
        setAlertCurrency={setEditCurrency}
        productName={
          editingAlert ? getProductName(editingAlert.productId) : ""
        }
        direction={editDirection}
        onDirectionChange={setEditDirection}
        distributors={editDistributors}
        selectedDistributorId={editDistributorId}
        onSelectDistributor={setEditDistributorId}
      />
    </ScreenContainer>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
