import { DialogOverlay } from "../DialogOverlay";
import { isUrlLike } from "../../lib/url-like";

export function ManualAddDialog({
  open,
  pasteText,
  onPasteText,
  urlInput,
  onUrlInput,
  urlParsing,
  manualParsing,
  manualError,
  manualProgress,
  manualTimedOut,
  manualRetrying,
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
  onManualParse,
  onUrlFetch,
  onManualAdd,
  onManualRetry,
  onClose,
}: {
  open: boolean;
  pasteText: string;
  onPasteText: (text: string) => void;
  urlInput: string;
  onUrlInput: (url: string) => void;
  urlParsing: boolean;
  manualParsing: boolean;
  manualError: { title: string; message: string; retry: boolean } | null;
  manualProgress: string | null;
  manualTimedOut: { id: string; name: string; modelNumber: string } | null;
  manualRetrying: boolean;
  manualName: string;
  onManualName: (name: string) => void;
  manualModel: string;
  onManualModel: (model: string) => void;
  manualBrand: string;
  onManualBrand: (brand: string) => void;
  manualCategory: string;
  onManualCategory: (category: string) => void;
  manualDescription: string;
  onManualDescription: (description: string) => void;
  manualDiscovering: boolean;
  brands: string[];
  categories: string[];
  onManualParse: () => void;
  onUrlFetch: () => void;
  onManualAdd: () => void;
  onManualRetry: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <DialogOverlay open onClose={onClose} label="Add Custom Product">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="font-semibold mb-1">Add Custom Product</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Paste anything — a model number, product name, or a spec-sheet paragraph. AI cleans it up.
        </p>
        <textarea value={pasteText} onChange={(e) => onPasteText(e.target.value)} rows={3} placeholder="Paste a model number, product name, or spec paragraph…" aria-label="Paste product text" className="w-full px-3 py-2 rounded-lg border text-sm mb-2" />
        <button onClick={onManualParse} disabled={!pasteText.trim() || manualParsing} className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">{manualParsing ? "Parsing…" : "Clean up with AI"}</button>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Paste distributor URL</p>
        <input value={urlInput} onChange={(e) => onUrlInput(e.target.value)} placeholder="https://distributor.com/product/..." aria-label="Distributor URL" className="w-full px-3 py-2 rounded-lg border text-sm mb-2" />
        <button onClick={onUrlFetch} disabled={!isUrlLike(urlInput) || urlParsing} className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">{urlParsing ? "Fetching…" : "Fetch from URL"}</button>
        {manualError && (
          <div role="alert" className="mb-3 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-left">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{manualError.title}</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{manualError.message}</p>
            {manualError.retry && <button onClick={onManualParse} className="mt-2 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700">Retry</button>}
          </div>
        )}
        {manualProgress && <p className="text-xs text-gray-500 mb-2">{manualProgress}</p>}
        {manualTimedOut && (
          <div role="alert" className="mb-3 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-left">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Discovery timed out</p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">Added {manualTimedOut.name} — listings can be retried.</p>
            <div className="flex gap-2 mt-2">
              <button onClick={onManualRetry} disabled={manualRetrying} aria-label="Retry discovery" className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-50">{manualRetrying ? "Retrying…" : "Retry"}</button>
              <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700">Done</button>
            </div>
          </div>
        )}
        <div className="space-y-3">
          <input value={manualName} onChange={(e) => onManualName(e.target.value)} placeholder="Product name *" className="w-full px-3 py-2 rounded-lg border text-sm" />
          <input value={manualModel} onChange={(e) => onManualModel(e.target.value)} placeholder="Model number *" className="w-full px-3 py-2 rounded-lg border text-sm" />
          <input value={manualBrand} onChange={(e) => onManualBrand(e.target.value)} placeholder="Brand" list="b-list" className="w-full px-3 py-2 rounded-lg border text-sm" /><datalist id="b-list">{brands.map((b) => <option key={b} value={b} />)}</datalist>
          <input value={manualCategory} onChange={(e) => onManualCategory(e.target.value)} placeholder="Category" list="c-list" className="w-full px-3 py-2 rounded-lg border text-sm" /><datalist id="c-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <textarea value={manualDescription} onChange={(e) => onManualDescription(e.target.value)} placeholder="Description" aria-label="Description" rows={2} className="w-full px-3 py-2 rounded-lg border text-sm" />
        </div>
        <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-3 py-2 rounded-lg border text-sm">Cancel</button><button onClick={onManualAdd} disabled={manualDiscovering} aria-label="Add manual product" className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-50">{manualDiscovering ? "Discovering…" : "Add"}</button></div>
      </div>
    </DialogOverlay>
  );
}
