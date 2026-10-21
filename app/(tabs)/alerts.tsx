import { log } from "@shared/log";
import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { useMemo } from "react";
import type { PriceAlert } from "@/lib/types";
import { PriceAlertModal } from "@/components/product/price-alert-modal";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/screen-container";
import { NotificationCenter } from "@/components/notification-center";
import { useColors } from "@/hooks/use-colors";
import { countActiveAlerts } from "@/lib/alert-state";
import { formatPrice } from "@shared/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAlertsData } from "@/hooks/use-alerts-data";
import { useCriterionWatches } from "@/hooks/use-criterion-watches";
import { useAlertEditDraft } from "@/hooks/use-alert-edit-draft";
import { AlertsHeader } from "@/components/alerts/alerts-header";
import { AlertsFab } from "@/components/alerts/alerts-fab";
import { CriterionWatchesSection } from "@/components/alerts/criterion-watches-section";
import { showAlert } from "@/lib/alert";
import { savingAlerts } from "@/lib/alert-savings";

import { TabSwitcher } from "@/components/alerts/tab-switcher";
import { AlertCard } from "@/components/alerts/alert-card";
import { TriggeredAlertCard } from "@/components/alerts/triggered-alert-card";
import { StockWatchCard } from "@/components/alerts/stock-watch-card";
import { ReminderCard } from "@/components/alerts/reminder-card";
import { RescheduleModal } from "@/components/alerts/reschedule-modal";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyStateView } from "@/components/ui/empty-state-view";

export default function AlertsScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    activeTab, setActiveTab,
    alerts, reminders, stockWatches,
    products,
    refreshing, loading, onRefresh, loadError,
    setUnreadNotifications,
    handleToggle, handleDeleteAlert, handleDeleteReminder,
    handleSnoozeAlert, handleUpdateAlert,
    handleRemoveStockWatch, handleReschedule, handleRearmAlert,
    getProductName, triggeredAlerts, totalSaved, displayCurrency, tabCount,
    rescheduleTarget, setRescheduleTarget,
    rescheduleDate, setRescheduleDate,
    showReschedulePicker, setShowReschedulePicker,
  } = useAlertsData();

  const { criterionWatches, handleRemoveCriterionWatch } =
    useCriterionWatches(refreshing, loading);

  const {
    editingAlert,
    setEditingAlert,
    editPrice,
    setEditPrice,
    editCurrency,
    setEditCurrency,
    editDirection,
    setEditDirection,
    editDistributorId,
    setEditDistributorId,
    handleEditAlert,
    editDistributors,
  } = useAlertEditDraft(alerts, products);

  const activeAlerts = useMemo(() => alerts.filter((a) => !a.triggeredAt), [alerts]);

  const alertsFlatData = useMemo(() => {
    type FlatItem =
      | { id: string; kind: "active"; alert: PriceAlert }
      | { id: string; kind: "divider" }
      | { id: string; kind: "savings" }
      | { id: string; kind: "triggeredHeader" }
      | { id: string; kind: "triggered"; alert: PriceAlert };
    const items: FlatItem[] = activeAlerts.map((a) => ({ id: a.id, kind: "active" as const, alert: a }));
    if (triggeredAlerts.length > 0) {
      items.push({ id: "__divider", kind: "divider" as const });
      if (typeof totalSaved === "number" && Number.isFinite(totalSaved) && totalSaved > 0) {
        items.push({ id: "__savings", kind: "savings" as const });
      }
      items.push({ id: "__triggeredHeader", kind: "triggeredHeader" as const });
      triggeredAlerts.forEach((a) => items.push({ id: a.id, kind: "triggered" as const, alert: a }));
    }
    return items;
  }, [activeAlerts, triggeredAlerts, totalSaved]);

  if (loading) {
    return (
      <ScreenContainer>
        <SkeletonList count={4} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AlertsHeader
        tabCount={tabCount}
        onRestockWatches={() => {
          if (Platform.OS !== "web")
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push("/restock-watches");
        }}
      />

      {/* Tab Switcher */}
      <TabSwitcher active={activeTab} counts={tabCount} onChange={setActiveTab} />

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <FlatList showsVerticalScrollIndicator={true}
          data={alertsFlatData}
          keyExtractor={(item) => item.id}
          initialNumToRender={8}
          windowSize={5}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 96 + insets.bottom,
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
            <>
              {loadError && (
                <View
                  style={{
                    backgroundColor: colors.error + "15",
                    borderRadius: 16,
                    padding: 12,
                    marginBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    borderWidth: 1,
                    borderColor: colors.error + "30",
                  }}
                >
                  <IconSymbol name="exclamationmark.triangle.fill" size={16} color={colors.error} />
                  <Text style={{ color: colors.error, fontSize: 13, flex: 1 }}>{loadError}</Text>
                  <TouchableOpacity activeOpacity={0.7} onPress={onRefresh} accessibilityLabel="Retry" accessibilityRole="button" style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.error + "22" }}>
                    <Text style={{ color: colors.error, fontWeight: "600", fontSize: 13 }}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}
              {countActiveAlerts(alerts) > 0 ? (
                <View
                  style={{
                    backgroundColor: colors.primary + "15",
                    borderRadius: 16,
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
                    You&apos;ll be notified when a product restocks or drops
                    below your target.
                  </Text>
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            alertsFlatData.length === 0 ? (
              <EmptyStateView
                icon="bell.fill"
                title="No alerts set"
                subtitle='Open a product and tap "Set Alert" to get notified when it restocks or the price drops.'
                ctaLabel="Browse Products"
                onCtaPress={() => router.push("/search")}
              />
            ) : undefined
          }
          renderItem={({ item }) => {
            if (item.kind === "active") {
              return (
                <AlertCard
                  alert={item.alert}
                  productName={getProductName(item.alert.productId)}
                  onToggle={handleToggle}
                  onDelete={handleDeleteAlert}
                  onSnooze={handleSnoozeAlert}
                  onEdit={handleEditAlert}
                />
              );
            }
            if (item.kind === "divider") {
              return <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 16, marginTop: 20 }} />;
            }
            if (item.kind === "savings") {
              return (
                <View
                  style={{
                    backgroundColor: colors.success + "18",
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    borderWidth: 1,
                    borderColor: colors.success + "44",
                  }}
                >
                  <IconSymbol name="star.fill" size={24} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.success,
                        fontWeight: "700",
                        fontSize: 15,
                      }}
                    >
                      Total Saved: {formatPrice(totalSaved, displayCurrency)}
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      Across {savingAlerts(triggeredAlerts).length} triggered
                      alert{savingAlerts(triggeredAlerts).length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
              );
            }
            if (item.kind === "triggeredHeader") {
              return (
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
                    Alert History ({triggeredAlerts.length})
                  </Text>
                </View>
              );
            }
            return (
              <TriggeredAlertCard
                alert={item.alert}
                productName={getProductName(item.alert.productId)}
                onRearm={handleRearmAlert}
                onDelete={handleDeleteAlert}
              />
            );
          }}
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
            paddingBottom: 96 + insets.bottom,
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
              {/* Criterion Watches section */}
              <CriterionWatchesSection
                watches={criterionWatches}
                onRemove={(id) => void handleRemoveCriterionWatch(id)}
              />
              {/* Empty state when all lists are empty */}
              {stockWatches.length === 0 &&
                reminders.length === 0 &&
                criterionWatches.length === 0 && (
                  <EmptyStateView
                    icon="calendar"
                    title="No reminders set"
                    subtitle='Open a back-order product listing and tap "Remind me" or "Watch for Restock".'
                    ctaLabel="Browse Products"
                    onCtaPress={() => router.push("/search")}
                  />
                )}
            </View>
          }
          renderItem={({ item }) => (
            <ReminderCard
              reminder={item}
              onReschedule={(r) => {
                const d = new Date(r.reminderDate);
                setRescheduleDate(isNaN(d.getTime()) ? new Date() : d);
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

      <AlertsFab
        visible={activeTab !== "notifications"}
        bottomInset={insets.bottom}
        onPress={() => router.push("/search")}
      />

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
          try {
            await handleUpdateAlert(editingAlert.id, {
              targetPrice: price,
              currency: editCurrency,
              direction: editDirection,
              distributorId: editDistributorId,
            });
          } catch (e) {
            log.error("[Alerts] update failed", e);
            showAlert("Update failed", "We couldn't save your changes. Please try again.");
            return;
          }
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
