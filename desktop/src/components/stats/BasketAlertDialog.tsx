import { DialogOverlay } from "../DialogOverlay";

export function BasketAlertDialog({
  open,
  displayCurrency,
  draft,
  threshold,
  onDraftChange,
  onClose,
  onSave,
}: {
  open: boolean;
  displayCurrency: string;
  draft: string;
  threshold: number | null;
  onDraftChange: (draft: string) => void;
  onClose: () => void;
  onSave: (threshold: number | null) => void;
}) {
  return (
    <DialogOverlay open={open} onClose={onClose} label="Basket Value Alert">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="font-semibold text-lg mb-1">Basket Value Alert</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Notify me when the total watchlist value drops below this amount
          ({displayCurrency}). Fires once, then turns off.
        </p>
        <label className="block text-xs font-semibold mb-1">
          Threshold ({displayCurrency})
        </label>
        <input
          type="number"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="e.g. 500"
          min="0"
          step="0.01"
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Basket alert threshold"
        />
        <div className="flex gap-2">
          {threshold != null && (
            <button
              onClick={() => {
                onSave(null);
                onClose();
              }}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700"
              aria-label="Disable basket alert"
            >
              Disable
            </button>
          )}
          <button
            onClick={() => {
              const numeric = parseFloat(draft);
              if (isNaN(numeric) || numeric <= 0) return;
              onSave(numeric);
              onClose();
            }}
            disabled={!(parseFloat(draft) > 0)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
            aria-label="Enable basket alert"
          >
            Enable
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}
