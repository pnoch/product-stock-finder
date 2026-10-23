import { DialogOverlay } from "../DialogOverlay";

export function SearchModalManualAddDialog({
  open,
  onClose,
  manualTimedOut,
  manualRetrying,
  manualProgress,
  manualName,
  onManualName,
  manualModel,
  onManualModel,
  manualBrand,
  onManualBrand,
  manualCategory,
  onManualCategory,
  manualDescription,
  onManualDescription,
  manualDiscovering,
  brands,
  categories,
  onManualAdd,
  onManualRetry,
}: {
  open: boolean;
  onClose: () => void;
  manualTimedOut: { id: string; name: string; modelNumber: string } | null;
  manualRetrying: boolean;
  manualProgress: string | null;
  manualName: string;
  onManualName: (value: string) => void;
  manualModel: string;
  onManualModel: (value: string) => void;
  manualBrand: string;
  onManualBrand: (value: string) => void;
  manualCategory: string;
  onManualCategory: (value: string) => void;
  manualDescription: string;
  onManualDescription: (value: string) => void;
  manualDiscovering: boolean;
  brands: string[];
  categories: string[];
  onManualAdd: () => void;
  onManualRetry: () => void;
}) {
  if (!open) return null;
  return (
    <DialogOverlay open onClose={onClose} label="Manual Add" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="font-semibold mb-3">Manual Add</h3>
        {manualTimedOut && (
          <div role="alert" className="mb-3 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-left">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Discovery timed out</p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">Added {manualTimedOut.name} — listings can be retried.</p>
            <div className="flex gap-2 mt-2">
              <button onClick={onManualRetry} disabled={manualRetrying} aria-label="Retry discovery" className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-50">{manualRetrying ? "Retrying…" : "Retry"}</button>
              <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">Done</button>
            </div>
          </div>
        )}
        {manualProgress && <p className="text-xs text-gray-500 mb-2">{manualProgress}</p>}
        <div className="space-y-3">
          <input value={manualName} onChange={(e) => onManualName(e.target.value)} placeholder="Product name *" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          <input value={manualModel} onChange={(e) => onManualModel(e.target.value)} placeholder="Model number *" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          <input value={manualBrand} onChange={(e) => onManualBrand(e.target.value)} placeholder="Brand" list="brand-list" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          <datalist id="brand-list">{brands.map((b) => <option key={b} value={b} />)}</datalist>
          <input value={manualCategory} onChange={(e) => onManualCategory(e.target.value)} placeholder="Category" list="cat-list" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <textarea value={manualDescription} onChange={(e) => onManualDescription(e.target.value)} placeholder="Description" aria-label="Description" rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">Cancel</button>
          <button onClick={onManualAdd} disabled={manualDiscovering} aria-label="Add manual product" className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-50">{manualDiscovering ? "Discovering…" : "Add"}</button>
        </div>
      </div>
    </DialogOverlay>
  );
}
