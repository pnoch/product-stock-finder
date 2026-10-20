import { Calendar } from "lucide-react";
import { DISTRIBUTORS } from "@shared/distributors";
import type { DistributorListing } from "../../../../lib/types";
import { Modal } from "../Modal";

export function ReminderDatePickerModal({
  open,
  onClose,
  productName,
  listings,
  distributorId,
  onDistributorChange,
  dateInput,
  onDateChange,
  error,
  saving,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  productName: string;
  listings: DistributorListing[];
  distributorId: string | null;
  onDistributorChange: (id: string | null) => void;
  dateInput: string;
  onDateChange: (value: string) => void;
  error: string | null;
  saving: boolean;
  onSave: () => void;
}) {
  return (
      <Modal
        open={open}
        onClose={onClose}
        title="Set Reminder"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Pick a date to be reminded to check{" "}
            <span className="font-medium">
              {DISTRIBUTORS.find((d) => d.id === distributorId)?.name ?? distributorId}
            </span>{" "}
            for {productName}.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Distributor</label>
            <select
              value={distributorId ?? ""}
              onChange={(e) => onDistributorChange(e.target.value || null)}
              aria-label="Distributor"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {listings.map((l) => {
                const d = DISTRIBUTORS.find((x) => x.id === l.distributorId);
                return (
                  <option key={l.distributorId} value={l.distributorId}>
                    {d?.countryCode} {d?.name ?? l.distributorId}
                  </option>
                );
              })}
            </select>
          </div>
          <button
            onClick={() => {
              const input = document.getElementById("reminder-date-picker") as HTMLInputElement | null;
              input?.showPicker?.();
              input?.focus();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-left"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold">
                {new Date(dateInput + "T12:00:00").toLocaleDateString(undefined, {
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
            id="reminder-date-picker"
            type="date"
            value={dateInput}
            onChange={(e) => onDateChange(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Reminder date"
          />
          {error && <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              Set Reminder
            </button>
          </div>
        </div>
      </Modal>

  );
}
