import { DISTRIBUTORS } from "@shared/distributors";
import { EXCHANGE_RATES, formatPrice } from "@shared/currency";
import type { DistributorListing } from "../../../../lib/types";
import { Modal } from "../Modal";

type Suggestion = { key: string; label: string; price: number };

export function SetAlertModal({
  open,
  onClose,
  productName,
  alertSaved,
  alertError,
  direction,
  onDirectionChange,
  distributorId,
  onDistributorChange,
  listings,
  suggestions,
  price,
  onPriceChange,
  currency,
  onCurrencyChange,
  saving,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  productName: string;
  alertSaved: boolean;
  alertError: string | null;
  direction: "drop" | "rise";
  onDirectionChange: (direction: "drop" | "rise") => void;
  distributorId: string | null;
  onDistributorChange: (id: string | null) => void;
  listings: DistributorListing[];
  suggestions: Suggestion[];
  price: string;
  onPriceChange: (value: string) => void;
  currency: string;
  onCurrencyChange: (value: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
      <Modal
        open={open}
        onClose={onClose}
        title="Set Price Alert"
      >
        {alertSaved ? (
          <div className="text-center py-4">
            <div className="text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
              Alert saved!
            </div>
            <p className="text-sm text-gray-500">
              You&apos;ll be notified when the price {direction === "drop" ? "drops below" : "rises above"} your target.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Get notified when{" "}
              <span className="font-medium">{productName}</span> {direction === "drop" ? "drops below" : "rises above"}
              {" "}your target price.
            </p>
            {alertError && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                {alertError}
              </div>
            )}
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {(["drop", "rise"] as const).map((dir) => (
                <button
                  key={dir}
                  onClick={() => onDirectionChange(dir)}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${direction === dir ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                  aria-label={dir === "drop" ? "Drops below" : "Rises above"}
                  aria-pressed={direction === dir}
                >
                  {dir === "drop" ? "▼ Drops below" : "▲ Rises above"}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Distributor</label>
              <select
                value={distributorId ?? ""}
                onChange={(e) => onDistributorChange(e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Alert distributor"
              >
                <option value="">Best available</option>
                {listings.map((l) => {
                  const d = DISTRIBUTORS.find((x) => x.id === l.distributorId);
                  return (
                    <option key={l.distributorId} value={l.distributorId}>
                      {d?.countryCode} {d?.name ?? l.distributorId} · {formatPrice(l.price, l.currency)}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Target Price
              </label>
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => onPriceChange(String(s.price))}
                      className="px-3 py-1.5 rounded-full border border-brand-500/40 bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-semibold hover:bg-brand-500/20 transition-colors"
                      aria-label={`Set price to ${s.label}`}
                    >
                      {s.label} · {formatPrice(s.price, currency)}
                    </button>
                  ))}
                </div>
              )}
              <input
                type="number"
                value={price}
                onChange={(e) => onPriceChange(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Target price"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Alert currency"
              >
                {Object.keys(EXCHANGE_RATES).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Cancel"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={saving || !price || parseFloat(price) <= 0}
                className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                aria-label="Save price alert"
              >
                Save Alert
              </button>
            </div>
          </div>
        )}
      </Modal>

  );
}
