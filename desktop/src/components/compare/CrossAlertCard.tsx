import { formatPrice } from "@shared/currency";

export function CrossAlertCard({
  alertTarget,
  crossBest,
  displayCurrency,
  onSetAlert,
}: {
  alertTarget: number;
  crossBest: number;
  displayCurrency: string;
  onSetAlert: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
      <div className="flex-1">
        <div className="text-sm font-semibold">Alert me if any distributor drops below</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {formatPrice(alertTarget, displayCurrency)} (5% below current best of {formatPrice(crossBest, displayCurrency)})
        </div>
      </div>
      <button
        onClick={onSetAlert}
        className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 shrink-0"
        aria-label="Set cross-distributor price alert"
      >
        Set alert
      </button>
    </div>
  );
}
