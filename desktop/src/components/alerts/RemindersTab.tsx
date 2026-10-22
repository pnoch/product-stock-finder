import { useNavigate } from "react-router";
import { Bell, Calendar, Clock, Trash2 } from "lucide-react";
import type { BackOrderReminder } from "../../../../lib/types";
import { EmptyState } from "../EmptyState";
import { StockBadge } from "../StockBadge";

export function RemindersTab({
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
  const navigate = useNavigate();
  const hasItems = reminders.length > 0 || watches.length > 0;

  if (!hasItems) {
    return (
      <div className="text-center">
        <EmptyState
          icon={<Clock className="w-12 h-12" />}
          title="No reminders set"
          description='Open a back-order product listing and click "Remind me" or "Watch for Restock".'
        />
        <button
          onClick={() => navigate("/search")}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
          aria-label="Browse products to set reminders"
        >
          <Clock className="w-4 h-4" /> Browse Products
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reminders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Date Reminders ({reminders.length})
          </h2>
          <div className="space-y-2">
            {reminders.map((r, idx) => {
              const reminderDate = new Date(r.reminderDate);
              const startOfToday = new Date();
              startOfToday.setHours(0, 0, 0, 0);
              const isPast = reminderDate < startOfToday;
              return (
              <div
                key={r.id}
                className={`flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border hover:shadow-sm transition-shadow animate-fadeIn ${isPast ? "border-amber-300 dark:border-amber-700" : "border-gray-200 dark:border-gray-700"}`}
                style={{ animationDelay: `${idx * 60}ms` } as React.CSSProperties}
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.productName}</p>
                  {isPast && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-semibold mt-1">
                      Past Due
                    </span>
                  )}
                  <p className={`text-sm ${isPast ? "text-amber-700 dark:text-amber-300" : "text-gray-500 dark:text-gray-400"}`}>
                    {r.distributorName} · {isPast ? "Was due " : "Remind on "}
                    {new Date(r.reminderDate).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
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
              );
            })}
          </div>
        </div>
      )}

      {watches.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Watching for Restock ({watches.length})
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
                <span className="text-xs text-gray-400 shrink-0">· last checked</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-semibold shrink-0">
                  Watching
                </span>
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
