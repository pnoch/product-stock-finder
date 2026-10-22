import type { Product } from "../../../../lib/types";

export function WatchlistUndoToast({
  product,
  onUndo,
  onDismiss,
}: {
  product: Product;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50">
      <span>Removed {product.name}</span>
      <button onClick={onUndo} className="px-3 py-1 rounded-lg bg-white text-gray-900 text-xs font-semibold hover:bg-gray-100">Undo</button>
      <button onClick={onDismiss} className="p-1 rounded hover:bg-white/10" aria-label="Dismiss undo">×</button>
    </div>
  );
}
