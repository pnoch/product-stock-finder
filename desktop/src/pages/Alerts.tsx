import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Bell,
  BellRing,
  Clock,
} from "lucide-react";
import { useAlerts } from "../hooks/use-storage";
import { useToast } from "../hooks/use-toast";
import { useAlertEdit } from "../hooks/use-alert-edit";
import { useRemindersData } from "../hooks/use-reminders-data";
import { useNotificationsData } from "../hooks/use-notifications-data";
import { useAlertMutations } from "../hooks/use-alert-mutations";
import { useReminderReschedule } from "../hooks/use-reminder-reschedule";
import { storage } from "../storage";
import { countOpenAlerts } from "../../../lib/alert-state";
import { AlertsTab } from "../components/alerts/AlertsTab";
import { RemindersTab } from "../components/alerts/RemindersTab";
import { EditAlertDialog } from "../components/alerts/EditAlertDialog";
import { RescheduleDialog } from "../components/alerts/RescheduleDialog";
import { NotificationsTab } from "../components/alerts/NotificationsTab";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type { Product } from "../../../lib/types";

type Tab = "alerts" | "reminders" | "notifications";

export function Alerts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab =
    tabParam === "reminders"
      ? "reminders"
      : tabParam === "notifications"
        ? "notifications"
        : "alerts";
  const setTab = (next: Tab) => setSearchParams({ tab: next });
  const {
    alerts,
    loading: alertsLoading,
    refresh: refreshAlerts,
  } = useAlerts();
  const { toast, showToast } = useToast();
  const {
    reminders,
    setReminders,
    watches,
    remindersLoading,
    remindersError,
    loadReminders,
    handleDeleteReminder,
    handleDeleteWatch,
  } = useRemindersData({ showToast });

  const [productNames, setProductNames] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [watchlistProducts, setWatchlistProducts] = useState<Product[]>([]);
  const {
    editingAlert,
    editPrice,
    setEditPrice,
    editCurrency,
    setEditCurrency,
    editDirection,
    setEditDirection,
    editDistributorId,
    setEditDistributorId,
    editError,
    editDistributors,
    handleEditAlert,
    handleSaveEdit,
    closeEditAlert,
  } = useAlertEdit({ watchlistProducts, showToast, refreshAlerts });

  const {
    rescheduleTarget,
    rescheduleDate,
    setRescheduleDate,
    rescheduleError,
    openReschedule,
    handleReschedule,
    closeReschedule,
  } = useReminderReschedule({ setReminders, showToast });


  const {
    notifications,
    unreadCount,
    notifError,
    refreshing,
    loadNotifications,
    handleRefreshNotifications,
    handleMarkAllRead,
    handleNotificationOpen,
  } = useNotificationsData({ showToast });

  useEffect(() => {
    // A storage read failure must not reject unhandled; the names/currency are
    // best-effort decoration and the lists still render without them.
    storage
      .getWatchlist()
      .then((w) => {
        setProductNames(new Map(w.map((p) => [p.id, p.name])));
        setWatchlistProducts(w);
      })
      .catch(() => {});
    storage
      .getSettings()
      .then((s) => {
        if (s?.displayCurrency) setDisplayCurrency(s.displayCurrency);
      })
      .catch(() => {});
  }, [loadNotifications]);

  const loading = alertsLoading || remindersLoading;

  const activeAlertCount = useMemo(
    () => countOpenAlerts(alerts),
    [alerts],
  );

  const { handleToggle, handleDeleteAlert, handleRearm, handleSnoozeAlert } =
    useAlertMutations({ refreshAlerts, showToast });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-[60] animate-fadeIn">
          {toast}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Alerts & Reminders</h1>
        <button
          onClick={() => navigate("/restock-watches")}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          aria-label="View restock watches"
        >
          Restock Watches
        </button>
      </div>

      {/* Tab bar — 3 tabs including Notifications (desktop routes to system tray) */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
        <button
          onClick={() => setTab("alerts")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "alerts"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
          aria-label="Show price alerts"
        >
          <Bell className="w-4 h-4 inline-block mr-1.5" />
          Alerts{activeAlertCount > 0 ? ` (${activeAlertCount})` : ""}
        </button>
        <button
          onClick={() => setTab("reminders")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "reminders"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
          aria-label="Show reminders and stock watches"
        >
          <Clock className="w-4 h-4 inline-block mr-1.5" />
          Reminders{reminders.length + watches.length > 0 ? ` (${reminders.length + watches.length})` : ""}
        </button>
        <button
          onClick={() => setTab("notifications")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "notifications"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
          aria-label="Show notifications"
        >
          <BellRing className="w-4 h-4 inline-block mr-1.5" />
          Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
        </button>
      </div>

      {tab === "alerts" ? (
        <AlertsTab
          alerts={alerts}
          productNames={productNames}
          displayCurrency={displayCurrency}
          onToggle={handleToggle}
          onDelete={handleDeleteAlert}
          onRearm={handleRearm}
          onSnooze={handleSnoozeAlert}
          onEdit={handleEditAlert}
        />
      ) : tab === "notifications" ? (
        <NotificationsTab
          notifications={notifications}
          unreadCount={unreadCount}
          notifError={notifError}
          refreshing={refreshing}
          onRefresh={() => void handleRefreshNotifications()}
          onMarkAllRead={() => void handleMarkAllRead()}
          onOpen={(n) => void handleNotificationOpen(n)}
          onRetry={() => void loadNotifications()}
        />
      ) : (
        <div className="space-y-4">
        {remindersError && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
            <span className="flex-1">{remindersError}</span>
            <button
              onClick={() => void loadReminders()}
              className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
              aria-label="Retry loading reminders"
            >
              Retry
            </button>
          </div>
        )}
        <RemindersTab
          reminders={reminders}
          watches={watches}
          onDeleteReminder={handleDeleteReminder}
          onDeleteWatch={handleDeleteWatch}
          onReschedule={openReschedule}
        />
        </div>
      )}

      {rescheduleTarget && (
        <RescheduleDialog
          target={rescheduleTarget}
          date={rescheduleDate}
          error={rescheduleError}
          onDateChange={setRescheduleDate}
          onClose={closeReschedule}
          onConfirm={() => void handleReschedule()}
        />
      )}
      {editingAlert && (
        <EditAlertDialog
          productName={productNames.get(editingAlert.productId)}
          price={editPrice}
          currency={editCurrency}
          direction={editDirection}
          distributorId={editDistributorId}
          distributors={editDistributors}
          error={editError}
          onPriceChange={setEditPrice}
          onCurrencyChange={setEditCurrency}
          onDirectionChange={setEditDirection}
          onDistributorChange={setEditDistributorId}
          onClose={closeEditAlert}
          onSave={() => void handleSaveEdit()}
        />
      )}
    </div>
  );
}
