import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bell,
  Clock,
  Trash2,
  RotateCcw,
  ToggleLeft,
  ToggleRight,
  Pause,
} from "lucide-react";
import { useAlerts } from "../hooks/use-storage";
import { storage } from "../storage";
import { formatPrice, convertPrice } from "../../../lib/currency";
import { StockBadge } from "../components/StockBadge";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type { BackOrderReminder } from "../../../lib/types";

type Tab = "alerts" | "reminders";

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
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

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

  useEffect(() => {
    storage.getWatchlist().then((w) => {
      setProductNames(new Map(w.map((p) => [p.id, p.name])));
    });
  }, []);

  const loading = alertsLoading || remindersLoading;

  const handleToggle = async (id: string) => {
    await storage.toggleAlert(id);
    const updated = await storage.getAlerts();
    const target = updated.find((a) => a.id === id);
    showToast(target?.isActive ? "Alert activated" : "Alert deactivated");
    refreshAlerts();
  };

  const handleDeleteAlert = async (id: string) => {
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
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 animate-fadeIn">
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

      {/* Tab bar */}
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
          Alerts
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
          Reminders
        </button>
      </div>

      {tab === "alerts" ? (
        <AlertsTab
          alerts={alerts}
          productNames={productNames}
          onToggle={handleToggle}
          onDelete={handleDeleteAlert}
          onRearm={handleRearm}
          onSnooze={handleSnoozeAlert}
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
  productNames,
  onToggle,
  onDelete,
  onRearm,
  onSnooze,
}: {
  alerts: ReturnType<typeof useAlerts>["alerts"];
  productNames: Map<string, string>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRearm: (id: string) => void;
  onSnooze: (id: string, days: number) => void;
}) {
  const navigate = useNavigate();
  const triggeredAlerts = useMemo(() => alerts.filter((a) => a.triggeredAt), [alerts]);
  const totalSaved = useMemo(() => {
    return triggeredAlerts.reduce((sum, a) => {
      if (a.triggeredPrice != null) {
        const saved = Math.max(0, a.targetPrice - a.triggeredPrice);
        const usd = convertPrice(saved, a.currency, "USD");
        if (usd === null) return sum;
        return sum + usd;
      }
      return sum;
    }, 0);
  }, [triggeredAlerts]);

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
                  Total Saved: {formatPrice(totalSaved, "USD")}
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
}: {
  alert: ReturnType<typeof useAlerts>["alerts"][number];
  productName?: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRearm: (id: string) => void;
  onSnooze: (id: string, days: number) => void;
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
