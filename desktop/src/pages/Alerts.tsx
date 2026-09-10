import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bell,
  BellRing,
  Calendar,
  Clock,
  Trash2,
  RotateCcw,
  ToggleLeft,
  ToggleRight,
  Pause,
  Pencil,
  X,
} from "lucide-react";
import { useAlerts } from "../hooks/use-storage";
import { useToast } from "../hooks/use-toast";
import { storage } from "../storage";
import {
  formatPrice,
  convertPrice,
  EXCHANGE_RATES,
} from "@shared/currency";
import { getDistributorById } from "@shared/distributors";
import { StockBadge } from "../components/StockBadge";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type {
  BackOrderReminder,
  NotificationHistoryEntry,
  Product,
  PriceAlert,
} from "../../../lib/types";

type Tab = "alerts" | "reminders" | "notifications";

export function Alerts() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("alerts");
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
    await storage.addBackOrderReminder({
      ...rescheduleTarget,
      reminderDate: picked.toISOString(),
    });
    const updated = await storage.getBackOrderReminders();
    setReminders(updated);
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
    void loadReminders();
  }, [loadReminders]);

  const loadNotifications = useCallback(async () => {
    setNotifError(null);
    try {
      const [history, unread] = await Promise.all([
        storage.getNotificationHistory?.() as Promise<NotificationHistoryEntry[]> | undefined,
        storage.getUnreadNotificationCount?.() as Promise<number> | undefined,
      ]);
      if (history) setNotifications(history);
      if (typeof unread === "number") setUnreadCount(unread);
    } catch {
      console.error("[Alerts] Failed to load notifications");
      setNotifError("Couldn't load notifications.");
    }
  }, []);

  useEffect(() => {
    storage.getWatchlist().then((w) => {
      setProductNames(new Map(w.map((p) => [p.id, p.name])));
      setWatchlistProducts(w);
    });
    storage.getSettings().then((s) => {
      if (s?.displayCurrency) setDisplayCurrency(s.displayCurrency);
    });
    void loadNotifications();
  }, [loadNotifications]);

  const loading = alertsLoading || remindersLoading;

  const activeAlertCount = useMemo(
    () =>
      alerts.filter(
        (a) => a.isActive && !a.triggeredAt && (!a.snoozedUntil || new Date(a.snoozedUntil).getTime() <= Date.now()),
      ).length,
    [alerts],
  );

  const handleToggle = async (id: string) => {
    await storage.toggleAlert(id);
    const updated = await storage.getAlerts();
    const target = updated.find((a) => a.id === id);
    showToast(target?.isActive ? "Alert activated" : "Alert deactivated");
    refreshAlerts();
  };

  const handleDeleteAlert = async (id: string) => {
    if (!window.confirm("Remove this price alert? This cannot be undone.")) return;
    await storage.removeAlert(id);
    showToast("Alert deleted");
    refreshAlerts();
  };

  const handleRearm = async (id: string) => {
    await storage.rearmAlert(id);
    showToast("Alert rearmed");
    refreshAlerts();
  };

  const handleSnoozeAlert = async (id: string, days: number) => {
    await storage.snoozeAlert(id, days);
    showToast(days === 0 ? "Alert resumed" : `Snoozed for ${days} day${days !== 1 ? "s" : ""}`);
    refreshAlerts();
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
      watchlistProducts
        .find((p) => p.id === productId)
        ?.listings.map((l) => {
          const d = getDistributorById(l.distributorId);
          return { id: l.distributorId, name: d?.name ?? l.distributorId, countryFlag: d?.countryFlag ?? "" };
        }) ?? []
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
    await storage.updateAlert(editingAlert.id, {
      targetPrice: price,
      currency: editCurrency,
      direction: editDirection,
      distributorId: editDistributorId,
    });
    setEditingAlert(null);
    showToast("Alert updated");
    refreshAlerts();
  };
  const handleMarkAllRead = async () => {
    try {
      await (storage.markAllNotificationsRead as unknown as () => Promise<void>)?.();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      console.error("[Alerts] Failed to update notification read state");
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
      console.error("[Alerts] Failed to update notification read state");
      showToast("Couldn't update notification. Try again.");
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (!window.confirm("Cancel this reminder? This cannot be undone.")) return;
    await storage.removeBackOrderReminder(id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const handleDeleteWatch = async (id: string) => {
    if (!window.confirm("Stop watching for this restock? This cannot be undone.")) return;
    await storage.removeStockWatch(id);
    setWatches((prev) => prev.filter((w) => w.id !== id));
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
          Alerts ({activeAlertCount})
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
          Reminders ({reminders.length + watches.length})
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
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">Mark all read</button>
            )}
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
                  n.type === "health" && n.distributorId
                    ? `/health/${n.distributorId}`
                    : n.productId
                      ? `/product/${n.productId}`
                      : null;
                const itemClassName = `flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border ${n.read ? "border-gray-200 dark:border-gray-700" : "border-brand-200 dark:border-brand-800 bg-brand-50/40 dark:bg-brand-900/10"} `;
                const content = (
                  <>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${n.type === "health" ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" : n.type === "reminder" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"}`}>
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{n.body}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                    {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-brand-600 shrink-0" aria-label="Unread" />}
                  </>
                );
                return route ? (
                  <Link key={n.id} to={route} onClick={() => void handleNotificationOpen(n)} className={itemClassName}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id} className={itemClassName}>
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

      {/* RescheduleModal — desktop port */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRescheduleTarget(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Reschedule Reminder
              </h3>
              <button
                onClick={() => setRescheduleTarget(null)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Close reschedule modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 truncate">
              Choose a new date for <span className="font-semibold text-gray-900 dark:text-gray-100">{rescheduleTarget.distributorName}</span> · {rescheduleTarget.productName}
            </p>
            <button
              onClick={() => {
                const input = document.getElementById("reschedule-date") as HTMLInputElement | null;
                input?.showPicker?.();
                input?.focus();
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 mb-3 text-left"
              aria-label="Select date"
            >
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-600" />
                <span className="text-sm font-semibold">
                  {new Date(rescheduleDate + "T12:00:00").toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </span>
              <span className="text-gray-400">▾</span>
            </button>
            <input
              id="reschedule-date"
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Reminder date"
            />
            {rescheduleError && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">{rescheduleError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setRescheduleTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700"
                aria-label="Cancel reschedule"
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                className="flex-1 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
                aria-label="Confirm reschedule"
              >
                Reschedule
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Alert Modal — desktop Tailwind port of components/product/price-alert-modal.tsx */}
      {editingAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingAlert(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-lg">Edit Alert</h3>
              <button onClick={() => setEditingAlert(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Close edit modal"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Get notified when {productNames.get(editingAlert.productId) ?? "this product"} {editDirection === "rise" ? "rises above" : "drops below"} your target.</p>
            {editError && <p className="text-xs text-red-600 dark:text-red-400 mb-3">{editError}</p>}
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.keys(EXCHANGE_RATES).map((c) => (
                <button key={c} onClick={() => setEditCurrency(c)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${editCurrency === c ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200"}`}>{c}</button>
              ))}
            </div>
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit mb-4">
              {(["drop", "rise"] as const).map((d) => (
                <button key={d} onClick={() => setEditDirection(d)} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${editDirection === d ? "bg-white dark:bg-gray-600 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>{d === "drop" ? "▼ Drops below" : "▲ Rises above"}</button>
              ))}
            </div>
            {editDistributors.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={() => setEditDistributorId(null)} className={`px-3 py-1 rounded-full text-xs font-semibold border ${editDistributorId == null ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"}`}>All distributors</button>
                {editDistributors.map((d) => (
                  <button key={d.id} onClick={() => setEditDistributorId(d.id)} className={`px-3 py-1 rounded-full text-xs font-semibold border ${editDistributorId === d.id ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"}`}>{d.countryFlag} {d.name}</button>
                ))}
              </div>
            )}
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1">Target price ({editCurrency})</label>
              <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder={`Target price in ${editCurrency}`} min="0" step="0.01" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingAlert(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold">Cancel</button>
              <button onClick={handleSaveEdit} className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertsTab({
  alerts,
  productNames,
  displayCurrency,
  onToggle,
  onDelete,
  onRearm,
  onSnooze,
  onEdit,
}: {
  alerts: ReturnType<typeof useAlerts>["alerts"];
  productNames: Map<string, string>;
  displayCurrency: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRearm: (id: string) => void;
  onSnooze: (id: string, days: number) => void;
  onEdit: (alert: PriceAlert) => void;
}) {
  const navigate = useNavigate();
  const triggeredAlerts = useMemo(() => alerts.filter((a) => a.triggeredAt), [alerts]);
  const totalSaved = useMemo(() => {
    return triggeredAlerts.reduce((sum, a) => {
      if (a.triggeredPrice != null) {
        const delta = a.direction === "rise" ? a.triggeredPrice - a.targetPrice : a.targetPrice - a.triggeredPrice;
        const saved = Math.max(0, delta);
        const converted = convertPrice(saved, a.currency, displayCurrency);
        if (converted === null) return sum;
        return sum + converted;
      }
      return sum;
    }, 0);
  }, [triggeredAlerts, displayCurrency]);

  if (alerts.length === 0 && triggeredAlerts.length === 0) {
    return (
      <div className="text-center">
        <EmptyState
          icon={<Bell className="w-12 h-12" />}
          title="No price alerts"
          description="Set price alerts from product details to get notified when prices drop."
        />
        <button
          onClick={() => navigate("/search")}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
          aria-label="Browse products to set alerts"
        >
          <Bell className="w-4 h-4" /> Browse Products
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.filter((a) => !a.triggeredAt).map((alert, idx) => (
        <div
          key={alert.id}
          className="animate-fadeIn"
          style={{ animationDelay: `${idx * 60}ms` } as React.CSSProperties}
        >
          <AlertRow
            alert={alert}
            productName={productNames.get(alert.productId)}
            onToggle={onToggle}
            onDelete={onDelete}
            onRearm={onRearm}
            onSnooze={onSnooze}
            onEdit={onEdit}
          />
        </div>
      ))}

      {triggeredAlerts.length > 0 && (
        <div className="pt-4 mt-2 border-t border-gray-200 dark:border-gray-700 space-y-3">
          {totalSaved > 0 && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <span className="text-2xl">🎉</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  Total Saved: {formatPrice(totalSaved, displayCurrency)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Across {triggeredAlerts.filter((a) => a.triggeredPrice != null).length} triggered alert
                  {triggeredAlerts.filter((a) => a.triggeredPrice != null).length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Price Drop History ({triggeredAlerts.length})</h3>
          </div>
          {triggeredAlerts.map((alert, idx) => (
            <div
              key={alert.id}
              className="animate-fadeIn"
              style={{ animationDelay: `${idx * 60}ms` } as React.CSSProperties}
            >
              <AlertRow
                alert={alert}
                productName={productNames.get(alert.productId)}
                onToggle={onToggle}
                onDelete={onDelete}
                onRearm={onRearm}
                onSnooze={onSnooze}
                onEdit={onEdit}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertRow({
  alert,
  productName,
  onToggle,
  onDelete,
  onRearm,
  onSnooze,
  onEdit,
}: {
  alert: ReturnType<typeof useAlerts>["alerts"][number];
  productName?: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRearm: (id: string) => void;
  onSnooze: (id: string, days: number) => void;
  onEdit: (alert: PriceAlert) => void;
}) {
  const isTriggered = !alert.isActive && alert.triggeredAt;
  const isSnoozed = !!alert.snoozedUntil && new Date(alert.snoozedUntil).getTime() > Date.now();
  const [showSnooze, setShowSnooze] = useState(false);
  return (
    <div
      className={`flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border transition-colors hover:shadow-sm ${
        isTriggered
          ? "border-emerald-200 dark:border-emerald-800"
          : isSnoozed
            ? "border-amber-200 dark:border-amber-800"
            : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 shrink-0">
        <Bell className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {productName ? (
            <Link
              to={`/product/${alert.productId}`}
              className="hover:underline"
              aria-label={`View ${productName} details`}
            >
              {productName}
            </Link>
          ) : (
            `Alert — target ${formatPrice(alert.targetPrice, alert.currency)}`
          )}
          {alert.distributorId ? (
            <span className="ml-1.5 text-xs text-gray-400 font-normal">
              at {alert.distributorId}
            </span>
          ) : null}
          {isSnoozed && <span className="ml-2 text-xs font-semibold text-amber-600 dark:text-amber-400">Snoozed until {new Date(alert.snoozedUntil!).toLocaleDateString()}</span>}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {isTriggered ? (
            <>
              Triggered at{" "}
              {formatPrice(
                alert.triggeredPrice ?? alert.targetPrice,
                alert.currency,
              )}{" "}
              on {new Date(alert.triggeredAt!).toLocaleDateString()}
            </>
          ) : (
            <>
              Target: {formatPrice(alert.targetPrice, alert.currency)} · Created{" "}
              {new Date(alert.createdAt).toLocaleDateString()}
              {alert.direction ? ` · ${alert.direction}` : ""}
            </>
          )}
        </p>
      </div>

      {isTriggered ? (
        <button
          onClick={() => onRearm(alert.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
          aria-label="Rearm price alert"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Rearm
        </button>
      ) : (
        <>
          <button
            onClick={() => onEdit(alert)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
            title="Edit alert (price/currency/direction/distributor)"
            aria-label="Edit price alert"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowSnooze((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${isSnoozed ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20" : "text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"}`}
              title={isSnoozed ? "Snoozed — click to change" : "Snooze alert"}
              aria-label="Snooze alert"
            >
              <Pause className="w-4 h-4" />
            </button>
            {showSnooze && (
              <div className="absolute right-0 top-9 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-1 flex flex-col gap-1 min-w-[140px]">
                <button onClick={() => { onSnooze(alert.id, 1); setShowSnooze(false); }} className="px-3 py-1.5 text-xs font-medium text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded">1 day</button>
                <button onClick={() => { onSnooze(alert.id, 7); setShowSnooze(false); }} className="px-3 py-1.5 text-xs font-medium text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded">7 days</button>
                <button onClick={() => { onSnooze(alert.id, 30); setShowSnooze(false); }} className="px-3 py-1.5 text-xs font-medium text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded">30 days</button>
                {isSnoozed && <button onClick={() => { onSnooze(alert.id, 0); setShowSnooze(false); }} className="px-3 py-1.5 text-xs font-medium text-left text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded">Wake now</button>}
              </div>
            )}
          </div>
          <button
            onClick={() => onToggle(alert.id)}
            className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg p-1.5 transition-colors"
            title={alert.isActive ? "Deactivate alert" : "Activate alert"}
            aria-label={alert.isActive ? "Deactivate alert" : "Activate alert"}
          >
            {alert.isActive ? (
              <ToggleRight className="w-5 h-5" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
          </button>
        </>
      )}

      <button
        onClick={() => onDelete(alert.id)}
        className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        title="Delete alert"
        aria-label="Delete price alert"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function RemindersTab({
  reminders,
  watches,
  onDeleteReminder,
  onDeleteWatch,
  onReschedule,
}: {
  reminders: BackOrderReminder[];
  watches: BackOrderReminder[];
  onDeleteReminder: (id: string) => void;
  onDeleteWatch: (id: string) => void;
  onReschedule: (r: BackOrderReminder) => void;
}) {
  const hasItems = reminders.length > 0 || watches.length > 0;

  if (!hasItems) {
    return (
      <EmptyState
        icon={<Clock className="w-12 h-12" />}
        title="No reminders or watches"
        description="Set reminders from product details to track restock dates."
      />
    );
  }

  return (
    <div className="space-y-6">
      {reminders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Date Reminders
          </h2>
          <div className="space-y-2">
            {reminders.map((r, idx) => (
              <div
                key={r.id}
                className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow animate-fadeIn"
                style={{ animationDelay: `${idx * 60}ms` } as React.CSSProperties}
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.productName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {r.distributorName} · Due{" "}
                    {new Date(r.reminderDate).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => onReschedule(r)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                  aria-label={`Reschedule reminder for ${r.productName}`}
                  title="Reschedule"
                >
                  <Calendar className="w-3.5 h-3.5" /> Reschedule
                </button>
                <button
                  onClick={() => onDeleteReminder(r.id)}
                  className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Delete reminder"
                  aria-label="Delete reminder"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {watches.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Stock Watches
          </h2>
          <div className="space-y-2">
            {watches.map((w, idx) => (
              <div
                key={w.id}
                className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow animate-fadeIn"
                style={{ animationDelay: `${(reminders.length + idx) * 60}ms` } as React.CSSProperties}
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{w.productName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {w.distributorName}
                  </p>
                </div>
                {w.lastKnownStatus && (
                  <StockBadge
                    status={
                      w.lastKnownStatus as
                        | "in_stock"
                        | "back_order"
                        | "out_of_stock"
                        | "unknown"
                    }
                  />
                )}
                <button
                  onClick={() => onDeleteWatch(w.id)}
                  className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Delete stock watch"
                  aria-label="Delete stock watch"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
