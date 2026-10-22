import { Calendar, X } from "lucide-react";
import type { BackOrderReminder } from "../../../../lib/types";
import { DialogOverlay } from "../DialogOverlay";

export function RescheduleDialog({
  target,
  date,
  error,
  onDateChange,
  onClose,
  onConfirm,
}: {
  target: BackOrderReminder;
  date: string;
  error: string | null;
  onDateChange: (date: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <DialogOverlay open onClose={onClose} label="Reschedule Reminder">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Reschedule Reminder
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close reschedule modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 truncate">
          Choose a new date for <span className="font-semibold text-gray-900 dark:text-gray-100">{target.distributorName}</span> · {target.productName}
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
              {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
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
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          min={new Date().toISOString().slice(0, 10)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Reminder date"
        />
        {error && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700"
            aria-label="Cancel reschedule"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
            aria-label="Confirm reschedule"
          >
            Reschedule
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}
