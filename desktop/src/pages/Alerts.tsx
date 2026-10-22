import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { log } from "@shared/log";
import {
  BarChart3,
  Bell,
  BellRing,
  CircleCheck,
  Clock,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Sparkles,
} from "lucide-react";
import { useAlerts } from "../hooks/use-storage";
import { useToast } from "../hooks/use-toast";
import { storage } from "../storage";
import { syncDesktopNotifications } from "../server-notifications";
import { getDistributorById } from "@shared/distributors";
import { countOpenAlerts } from "../../../lib/alert-state";
import { formatRelativeTime } from "../../../lib/relative-time";
import { AlertsTab } from "../components/alerts/AlertsTab";
import { RemindersTab } from "../components/alerts/RemindersTab";
import { EditAlertDialog } from "../components/alerts/EditAlertDialog";
import { RescheduleDialog } from "../components/alerts/RescheduleDialog";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type {
  BackOrderReminder,
  NotificationHistoryEntry,
  Product,
  PriceAlert,
} from "../../../lib/types";

type Tab = "alerts" | "reminders" | "notifications";

const TYPE_ICONS = {
  price_drop: TrendingDown,
  price_rise: TrendingUp,
  restock: CircleCheck,
  reminder: Clock,
  health: TriangleAlert,
  digest: BarChart3,
  suspicious_price: TriangleAlert,
  criterion_match: Sparkles,
} as const;

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
  const [reminders, setReminders] = useState<BackOrderReminder[]>([]);
  const [watches, setWatches] = useState<BackOrderReminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [productNames, setProductNames] = useState<Map<string, string>>(
    () => new Map(),
  );
  const { toast, showToast } = useToast();
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [notifications, setNotifications] = useState<NotificationHistoryEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [watchlistProducts, setWatchlistProducts] = useState<Product[]>([]);
  // Edit modal — desktop port of components/product/price-alert-modal.tsx (price/currency/direction/distributor)
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editCurrency, setEditCurrency] = useState("USD");
  const [editDirection, setEditDirection] = useState<"drop" | "rise">("drop");
  const [editDistributorId, setEditDistributorId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // RescheduleModal — desktop port of components/alerts/reschedule-modal.tsx
  const [rescheduleTarget, setRescheduleTarget] = useState<BackOrderReminder | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const openReschedule = (r: BackOrderReminder) => {
    setRescheduleTarget(r);
    const d = new Date(r.reminderDate);
    const iso = isNaN(d.getTime()) ? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
    setRescheduleDate(iso);
    setRescheduleError(null);
  };
  const handleReschedule = async () => {
    if (!rescheduleTarget) return;
    const picked = new Date(rescheduleDate + "T12:00:00");
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (isNaN(picked.getTime()) || picked.getTime() < startOfToday.getTime()) {
      setRescheduleError("Please select today or a future date.");
      return;
    }
    try {
      await storage.addBackOrderReminder({
        ...rescheduleTarget,
        reminderDate: picked.toISOString(),
      });
      const updated = await storage.getBackOrderReminders();
      setReminders(updated);
    } catch {
      setRescheduleError("Couldn't save the new date. Please try again.");
      return;
    }
    const label = picked.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
    setRescheduleTarget(null);
    setRescheduleError(null);
    showToast(`Rescheduled to ${label}`);
  };

  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [notifError, setNotifError] = useState<string | null>(null);

  const loadReminders = useCallback(async () => {
    setRemindersLoading(true);
    setRemindersError(null);
    try {
      const [r, w] = await Promise.all([
        storage.getBackOrderReminders(),
        storage.getStockWatches(),
      ]);
      setReminders(r);
      setWatches(w);
    } catch (e) {
      setRemindersError(e instanceof Error ? e.message : "Couldn't load reminders");
    } finally {
      setRemindersLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadReminders();
    });
  }, [loadReminders]);

  const loadNotifications = useCallback(async () => {
    setNotifError(null);
    try {
      const [history, unread] = await Promise.all([
        storage.getNotificationHistory(),
        storage.getUnreadNotificationCount(),
      ]);
      setNotifications(history);
      setUnreadCount(unread);
    } catch {
      log.error("[Alerts] Failed to load notifications");
      setNotifError("Couldn't load notifications.");
    }
  }, []);

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
    queueMicrotask(() => {
      void loadNotifications();
    });
  }, [loadNotifications]);

  const loading = alertsLoading || remindersLoading;

  const activeAlertCount = useMemo(
    () => countOpenAlerts(alerts),
    [alerts],
  );

  // Storage writes can reject (quota/IDB error). Without a catch the rejection
  // was unhandled and the user saw nothing; mobile surfaces an alert for each.
  const handleToggle = async (id: string) => {
    try {
      await storage.toggleAlert(id);
      const updated = await storage.getAlerts();
      const target = updated.find((a) => a.id === id);
      showToast(target?.isActive ? "Alert activated" : "Alert deactivated");
      refreshAlerts();
    } catch {
      showToast("Couldn't update that alert. Please try again.");
    }
  };

  const handleDeleteAlert = async (id: string) => {
    if (!window.confirm("Remove this price alert? This cannot be undone.")) return;
    try {
      await storage.removeAlert(id);
      showToast("Alert deleted");
      refreshAlerts();
    } catch {
      showToast("Couldn't delete that alert. Please try again.");
    }
  };

  const handleRearm = async (id: string) => {
    try {
      await storage.rearmAlert(id);
      showToast("Alert rearmed");
      refreshAlerts();
    } catch {
      showToast("Couldn't re-arm that alert. Please try again.");
    }
  };

  const handleSnoozeAlert = async (id: string, days: number) => {
    try {
      await storage.snoozeAlert(id, days);
      showToast(days === 0 ? "Alert resumed" : `Snoozed for ${days} day${days !== 1 ? "s" : ""}`);
      refreshAlerts();
    } catch {
      showToast("Couldn't snooze that alert. Please try again.");
    }
  };

  const handleEditAlert = (alert: PriceAlert) => {
    setEditingAlert(alert);
    setEditPrice(String(alert.targetPrice));
    setEditCurrency(alert.currency);
    setEditDirection(alert.direction ?? "drop");
    setEditDistributorId(alert.distributorId ?? null);
    setEditError(null);
  };
  const editDistributors = useMemo(() => {
    if (!editingAlert) return [];
    const productId = editingAlert.productId;
    return (
      (watchlistProducts.find((p) => p.id === productId)?.listings ?? []).map(
        (l) => {
          const d = getDistributorById(l.distributorId);
          return { id: l.distributorId, name: d?.name ?? l.distributorId, countryCode: d?.countryCode ?? "" };
        },
      )
    );
  }, [editingAlert, watchlistProducts]);
  const handleSaveEdit = async () => {
    if (!editingAlert) return;
    const price = parseFloat(editPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setEditError("Please enter a valid target price.");
      return;
    }
    setEditError(null);
    try {
      await storage.updateAlert(editingAlert.id, {
        targetPrice: price,
        currency: editCurrency,
        direction: editDirection,
        distributorId: editDistributorId,
      });
    } catch {
      setEditError("Couldn't save your changes. Please try again.");
      return;
    }
    setEditingAlert(null);
    showToast("Alert updated");
    refreshAlerts();
  };
  const [refreshing, setRefreshing] = useState(false);
  const handleRefreshNotifications = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncDesktopNotifications();
    } finally {
      await loadNotifications();
      setRefreshing(false);
    }
  }, [loadNotifications]);
  const handleMarkAllRead = async () => {
    try {
      await (storage.markAllNotificationsRead as unknown as () => Promise<void>)?.();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      log.error("[Alerts] Failed to update notification read state");
      showToast("Couldn't update notification. Try again.");
    }
  };
  const handleNotificationOpen = async (n: NotificationHistoryEntry) => {
    if (n.read) return;
    try {
      await storage.markNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      log.error("[Alerts] Failed to update notification read state");
      showToast("Couldn't update notification. Try again.");
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (!window.confirm("Cancel this reminder? This cannot be undone.")) return;
    try {
      await storage.removeBackOrderReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch {
      showToast("Couldn't cancel that reminder. Please try again.");
    }
  };

  const handleDeleteWatch = async (id: string) => {
    if (!window.confirm("Stop watching for this restock? This cannot be undone.")) return;
    try {
      await storage.removeStockWatch(id);
      setWatches((prev) => prev.filter((w) => w.id !== id));
    } catch {
      showToast("Couldn't remove that watch. Please try again.");
    }
  };

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
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">On desktop, notifications route to system tray</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Alerts, restocks, and reminders appear as native OS notifications when the app is running.</p>
            </div>
            <Link to="/settings" className="shrink-0 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40">Settings</Link>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">{unreadCount > 0 ? `${unreadCount} unread` : notifications.length > 0 ? "All caught up" : "No notifications yet"}</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => void handleRefreshNotifications()}
                disabled={refreshing}
                aria-label="Refresh notifications"
                className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50"
              >
                {refreshing ? "Refreshing" : "Refresh"}
              </button>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">Mark all read</button>
              )}
            </div>
          </div>
          {notifError && (
            <div role="alert" className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
              <span className="flex-1">{notifError}</span>
              <button
                onClick={() => void loadNotifications()}
                className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
                aria-label="Retry loading notifications"
              >
                Retry
              </button>
            </div>
          )}
          {notifications.length === 0 ? (
            <EmptyState icon={<BellRing className="w-12 h-12" />} title="No notifications yet" description="Price alerts and restock updates will appear here and in your system tray." />
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => {
                const route =
                  n.type === "health"
                    ? n.distributorId
                      ? `/health/${n.distributorId}`
                      : "/health"
                    : n.type === "digest"
                      ? "/stats"
                      : n.productId
                        ? `/product/${n.productId}`
                        : null;
                const itemClassName = `flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border ${n.read ? "border-gray-200 dark:border-gray-700" : "border-brand-200 dark:border-brand-800 bg-brand-50/40 dark:bg-brand-900/10"} `;
                const TypeIcon =
                  n.type === "health" && n.healthStatus === "recovered"
                    ? CircleCheck
                    : TYPE_ICONS[n.type] ?? Bell;
                const content = (
                  <>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${n.type === "health" ? (n.healthStatus === "recovered" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400") : n.type === "reminder" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"}`}>
                      <TypeIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{n.body}</p>
                      <p className="text-[11px] text-gray-400 mt-1" title={new Date(n.createdAt).toLocaleString()}>{formatRelativeTime(n.createdAt)}</p>
                    </div>
                    {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-brand-600 shrink-0" aria-label="Unread" />}
                  </>
                );
                return route ? (
                  <Link key={n.id} to={route} onClick={() => void handleNotificationOpen(n)} className={itemClassName}>
                    {content}
                  </Link>
                ) : (
                  // No route (e.g. an event without a product/distributor):
                  // still mark it read on click, which mobile's always-pressable
                  // item does.
                  <div
                    key={n.id}
                    className={`${itemClassName} cursor-pointer`}
                    onClick={() => void handleNotificationOpen(n)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void handleNotificationOpen(n);
                      }
                    }}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
          onClose={() => setRescheduleTarget(null)}
          onConfirm={handleReschedule}
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
          onClose={() => setEditingAlert(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
