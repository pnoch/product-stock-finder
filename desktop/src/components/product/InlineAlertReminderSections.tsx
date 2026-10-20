import { EXCHANGE_RATES } from "@shared/currency";
import { DISTRIBUTORS } from "@shared/distributors";
import type { DistributorListing } from "../../../../lib/types";

export function InlineAlertReminderSections({
  listings,
  alertDirection,
  onAlertDirectionChange,
  alertDistributorId,
  onAlertDistributorChange,
  alertPrice,
  onAlertPriceChange,
  alertCurrency,
  onAlertCurrencyChange,
  onAddAlert,
  reminderDistributorId,
  onReminderDistributorChange,
  reminderDate,
  onReminderDateChange,
  reminderError,
  onAddReminder,
}: {
  listings: DistributorListing[];
  alertDirection: "drop" | "rise";
  onAlertDirectionChange: (direction: "drop" | "rise") => void;
  alertDistributorId: string | null;
  onAlertDistributorChange: (id: string | null) => void;
  alertPrice: string;
  onAlertPriceChange: (value: string) => void;
  alertCurrency: string;
  onAlertCurrencyChange: (value: string) => void;
  onAddAlert: () => void;
  reminderDistributorId: string | null;
  onReminderDistributorChange: (id: string | null) => void;
  reminderDate: string;
  onReminderDateChange: (value: string) => void;
  reminderError: string | null;
  onAddReminder: () => void;
}) {
  return (
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold mb-1">Price Alert</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Create an alert for this product.</p>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-3">
            {(["drop", "rise"] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => onAlertDirectionChange(dir)}
                className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${alertDirection === dir ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
                aria-pressed={alertDirection === dir}
              >
                {dir === "drop" ? "▼ Drops below" : "▲ Rises above"}
              </button>
            ))}
          </div>
          <div className="space-y-2 mb-3">
            <select
              value={alertDistributorId ?? ""}
              onChange={(e) => onAlertDistributorChange(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              aria-label="Inline alert distributor"
            >
              <option value="">Best available</option>
              {listings.map((l) => {
                const d = DISTRIBUTORS.find((x) => x.id === l.distributorId);
                return (
                  <option key={l.distributorId} value={l.distributorId}>
                    {d?.countryCode} {d?.name ?? l.distributorId}
                  </option>
                );
              })}
            </select>
            <div className="flex gap-2">
              <input
                type="number"
                value={alertPrice}
                onChange={(e) => onAlertPriceChange(e.target.value)}
                placeholder="Target price"
                min="0"
                step="0.01"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                aria-label="Inline alert price"
              />
              <select
                value={alertCurrency}
                onChange={(e) => onAlertCurrencyChange(e.target.value)}
                className="w-24 px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                aria-label="Inline alert currency"
              >
                {Object.keys(EXCHANGE_RATES).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={onAddAlert}
            disabled={!alertPrice || parseFloat(alertPrice) <= 0}
            className="w-full px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
          >
            Add Alert
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold mb-1">Back-order Reminder</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Get reminded to check for restock.</p>
          <div className="space-y-2 mb-3">
            <select
              value={reminderDistributorId ?? ""}
              onChange={(e) => onReminderDistributorChange(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              aria-label="Inline reminder distributor"
            >
              <option value="">Select distributor</option>
              {listings.map((l) => {
                const d = DISTRIBUTORS.find((x) => x.id === l.distributorId);
                return (
                  <option key={l.distributorId} value={l.distributorId}>
                    {d?.countryCode} {d?.name ?? l.distributorId}
                  </option>
                );
              })}
            </select>
            <input
              type="date"
              value={reminderDate}
              onChange={(e) => onReminderDateChange(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              aria-label="Inline reminder date"
            />
            {reminderError && <p className="text-xs text-amber-600">{reminderError}</p>}
          </div>
          <button
            onClick={onAddReminder}
            className="w-full px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
          >
            Remind Me
          </button>
        </div>
      </div>
  );
}
