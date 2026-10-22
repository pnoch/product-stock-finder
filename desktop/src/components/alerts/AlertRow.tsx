import { useState } from "react";
import { Link } from "react-router";
import {
  Bell,
  Pause,
  Pencil,
  RotateCcw,
  ToggleLeft,
  ToggleRight,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { formatPrice } from "@shared/currency";
import { getDistributorById } from "@shared/distributors";
import type { PriceAlert } from "../../../../lib/types";

export function AlertRow({
  alert,
  productName,
  onToggle,
  onDelete,
  onRearm,
  onSnooze,
  onEdit,
}: {
  alert: PriceAlert;
  productName?: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRearm: (id: string) => void;
  onSnooze: (id: string, days: number) => void;
  onEdit: (alert: PriceAlert) => void;
}) {
  const [now] = useState(() => Date.now());
  const isTriggered = !alert.isActive && alert.triggeredAt;
  const isSnoozed = !!alert.snoozedUntil && new Date(alert.snoozedUntil).getTime() > now;
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
              at {(() => { const d = getDistributorById(alert.distributorId!); return d ? `${d.countryCode} ${d.name}` : alert.distributorId; })()}
            </span>
          ) : null}
          {isSnoozed && <span className="ml-2 text-xs font-semibold text-amber-600 dark:text-amber-400">Snoozed until {new Date(alert.snoozedUntil!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {isTriggered ? (
            <>
              {alert.direction && (
                <span className="mr-1 inline-flex items-center align-middle">
                  {alert.direction === "rise" ? (
                    <TrendingUp className="w-3.5 h-3.5 inline text-red-500" aria-label="Price rise alert" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 inline text-emerald-500" aria-label="Price drop alert" />
                  )}
                </span>
              )}
              Target: {formatPrice(alert.targetPrice, alert.currency)}
              {alert.triggeredPrice && alert.triggeredPrice > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {" "}→ {formatPrice(alert.triggeredPrice, alert.currency)}
                </span>
              )}{" "}
              · Triggered on {new Date(alert.triggeredAt!).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </>
          ) : (
            <>
              Target: {formatPrice(alert.targetPrice, alert.currency)} · Created{" "}
              {new Date(alert.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {alert.direction && (
                <span className="ml-1 inline-flex items-center align-middle">
                  {alert.direction === "rise" ? (
                    <TrendingUp className="w-3.5 h-3.5 inline text-red-500" aria-label="Price rise alert" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 inline text-emerald-500" aria-label="Price drop alert" />
                  )}
                </span>
              )}
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
          Watch Again
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
