import { useState, useEffect } from "react";
import { Bell, Clock, Trash2, RotateCcw, ToggleLeft, ToggleRight } from "lucide-react";
import { useAlerts } from "../hooks/use-storage";
import { storage } from "../storage";
import { formatPrice } from "../../../lib/currency";
import { StockBadge } from "../components/StockBadge";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type { BackOrderReminder } from "../../../lib/types";

type Tab = "alerts" | "reminders";

export function Alerts() {
  const [tab, setTab] = useState<Tab>("alerts");
  const { alerts, loading: alertsLoading, refresh: refreshAlerts } = useAlerts();
  const [reminders, setReminders] = useState<BackOrderReminder[]>([]);
  const [watches, setWatches] = useState<BackOrderReminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [r, w] = await Promise.all([
        storage.getBackOrderReminders(),
        storage.getStockWatches(),
      ]);
      setReminders(r);
      setWatches(w);
      setRemindersLoading(false);
    })();
  }, []);

  const loading = alertsLoading || remindersLoading;

  const handleToggle = async (id: string) => {
    await storage.toggleAlert(id);
    refreshAlerts();
  };

  const handleDeleteAlert = async (id: string) => {
    await storage.removeAlert(id);
    refreshAlerts();
  };

  const handleRearm = async (id: string) => {
    await storage.rearmAlert(id);
    refreshAlerts();
  };

  const handleDeleteReminder = async (id: string) => {
    await storage.removeBackOrderReminder(id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const handleDeleteWatch = async (id: string) => {
    await storage.removeStockWatch(id);
    setWatches((prev) => prev.filter((w) => w.id !== id));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Alerts & Reminders</h1>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
        <button
          onClick={() => setTab("alerts")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "alerts"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <Bell className="w-4 h-4 inline-block mr-1.5" />
          Alerts
        </button>
        <button
          onClick={() => setTab("reminders")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "reminders"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <Clock className="w-4 h-4 inline-block mr-1.5" />
          Reminders
        </button>
      </div>

      {tab === "alerts" ? (
        <AlertsTab
          alerts={alerts}
          onToggle={handleToggle}
          onDelete={handleDeleteAlert}
          onRearm={handleRearm}
        />
      ) : (
        <RemindersTab
          reminders={reminders}
          watches={watches}
          onDeleteReminder={handleDeleteReminder}
          onDeleteWatch={handleDeleteWatch}
        />
      )}
    </div>
  );
}

function AlertsTab({
  alerts,
  onToggle,
  onDelete,
  onRearm,
}: {
  alerts: ReturnType<typeof useAlerts>["alerts"];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRearm: (id: string) => void;
}) {
  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={<Bell className="w-12 h-12" />}
        title="No price alerts"
        description="Set price alerts from product details to get notified when prices drop."
      />
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <AlertRow
          key={alert.id}
          alert={alert}
          onToggle={onToggle}
          onDelete={onDelete}
          onRearm={onRearm}
        />
      ))}
    </div>
  );
}

function AlertRow({
  alert,
  onToggle,
  onDelete,
  onRearm,
}: {
  alert: ReturnType<typeof useAlerts>["alerts"][number];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRearm: (id: string) => void;
}) {
  const isTriggered = !alert.isActive && alert.triggeredAt;
  return (
    <div
      className={`flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border transition-colors ${
        isTriggered
          ? "border-emerald-200 dark:border-emerald-800"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {alert.distributorId
            ? `Alert for ${alert.distributorId}`
            : `Alert — target ${formatPrice(alert.targetPrice, alert.currency)}`}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {isTriggered ? (
            <>
              Triggered at{" "}
              {formatPrice(alert.triggeredPrice ?? alert.targetPrice, alert.currency)} on{" "}
              {new Date(alert.triggeredAt!).toLocaleDateString()}
            </>
          ) : (
            <>
              Target: {formatPrice(alert.targetPrice, alert.currency)} · Created{" "}
              {new Date(alert.createdAt).toLocaleDateString()}
            </>
          )}
        </p>
      </div>

      {isTriggered ? (
        <button
          onClick={() => onRearm(alert.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Rearm
        </button>
      ) : (
        <button
          onClick={() => onToggle(alert.id)}
          className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg p-1.5 transition-colors"
          title={alert.isActive ? "Deactivate alert" : "Activate alert"}
        >
          {alert.isActive ? (
            <ToggleRight className="w-5 h-5" />
          ) : (
            <ToggleLeft className="w-5 h-5" />
          )}
        </button>
      )}

      <button
        onClick={() => onDelete(alert.id)}
        className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        title="Delete alert"
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
}: {
  reminders: BackOrderReminder[];
  watches: BackOrderReminder[];
  onDeleteReminder: (id: string) => void;
  onDeleteWatch: (id: string) => void;
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
            {reminders.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.productName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {r.distributorName} · Due{" "}
                    {new Date(r.reminderDate).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => onDeleteReminder(r.id)}
                  className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Delete reminder"
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
            {watches.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{w.productName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {w.distributorName}
                  </p>
                </div>
                {w.lastKnownStatus && (
                  <StockBadge status={w.lastKnownStatus as "in_stock" | "back_order" | "out_of_stock" | "unknown"} />
                )}
                <button
                  onClick={() => onDeleteWatch(w.id)}
                  className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Delete stock watch"
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
