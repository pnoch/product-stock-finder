import { X } from "lucide-react";
import { EXCHANGE_RATES } from "@shared/currency";
import { DialogOverlay } from "../DialogOverlay";

export function EditAlertDialog({
  productName,
  price,
  currency,
  direction,
  distributorId,
  distributors,
  error,
  onPriceChange,
  onCurrencyChange,
  onDirectionChange,
  onDistributorChange,
  onClose,
  onSave,
}: {
  productName?: string;
  price: string;
  currency: string;
  direction: "drop" | "rise";
  distributorId: string | null;
  distributors: { id: string; name: string; countryCode: string }[];
  error: string | null;
  onPriceChange: (price: string) => void;
  onCurrencyChange: (currency: string) => void;
  onDirectionChange: (direction: "drop" | "rise") => void;
  onDistributorChange: (id: string | null) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <DialogOverlay open onClose={onClose} label="Edit Alert">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg">Edit Alert</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Close edit modal"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Get notified when {productName ?? "this product"} {direction === "rise" ? "rises above" : "drops below"} your target.</p>
        {error && <p className="text-xs text-red-600 dark:text-red-400 mb-3">{error}</p>}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.keys(EXCHANGE_RATES).map((c) => (
            <button key={c} onClick={() => onCurrencyChange(c)} aria-pressed={currency === c} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${currency === c ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200"}`}>{c}</button>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit mb-4">
          {(["drop", "rise"] as const).map((d) => (
            <button key={d} onClick={() => onDirectionChange(d)} aria-pressed={direction === d} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${direction === d ? "bg-white dark:bg-gray-600 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>{d === "drop" ? "▼ Drops below" : "▲ Rises above"}</button>
          ))}
        </div>
        {distributors.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => onDistributorChange(null)} aria-pressed={distributorId == null} className={`px-3 py-1 rounded-full text-xs font-semibold border ${distributorId == null ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"}`}>All distributors</button>
            {distributors.map((d) => (
              <button key={d.id} onClick={() => onDistributorChange(d.id)} aria-pressed={distributorId === d.id} className={`px-3 py-1 rounded-full text-xs font-semibold border ${distributorId === d.id ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"}`}>{d.countryCode} {d.name}</button>
            ))}
          </div>
        )}
        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1">Target price ({currency})</label>
          <input type="number" value={price} onChange={(e) => onPriceChange(e.target.value)} placeholder={`Target price in ${currency}`} min="0" step="0.01" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold">Cancel</button>
          <button onClick={onSave} className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700">Save Changes</button>
        </div>
      </div>
    </DialogOverlay>
  );
}
