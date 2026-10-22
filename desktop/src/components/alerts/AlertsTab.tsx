import { useMemo } from "react";
import { useNavigate } from "react-router";
import { Bell, Info, RotateCcw, Star } from "lucide-react";
import { formatPrice } from "@shared/currency";
import { computeTotalSaved, savingAlerts } from "../../../../lib/alert-savings";
import type { PriceAlert } from "../../../../lib/types";
import { EmptyState } from "../EmptyState";
import { AlertRow } from "./AlertRow";

export function AlertsTab({
  alerts,
  productNames,
  displayCurrency,
  onToggle,
  onDelete,
  onRearm,
  onSnooze,
  onEdit,
}: {
  alerts: PriceAlert[];
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
  const totalSaved = useMemo(
    () => computeTotalSaved(triggeredAlerts, displayCurrency),
    [triggeredAlerts, displayCurrency],
  );

  if (alerts.length === 0 && triggeredAlerts.length === 0) {
    return (
      <div className="text-center">
        <EmptyState
          icon={<Bell className="w-12 h-12" />}
          title="No alerts set"
          description='Open a product and click "Set Alert" to get notified when it restocks or the price drops.'
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
      {alerts.filter((a) => !a.triggeredAt).length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-brand-600/10 border border-brand-600/20 rounded-xl">
          <Info className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
          <p className="text-sm text-brand-600 dark:text-brand-400">
            You&apos;ll be notified when a product restocks or drops below your target.
          </p>
        </div>
      )}
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
              <Star className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1">
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  Total Saved: {formatPrice(totalSaved, displayCurrency)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Across {savingAlerts(triggeredAlerts).length} triggered alert
                  {savingAlerts(triggeredAlerts).length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Alert History ({triggeredAlerts.length})</h3>
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
