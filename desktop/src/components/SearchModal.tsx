import { useState, useEffect, useRef } from "react";
import { Search, Check, Plus } from "lucide-react";
import { searchCatalog, PRODUCT_CATALOG } from "../../../lib/catalog";
import { storage } from "../storage";
import { Modal } from "./Modal";
import { ProductImage } from "./ProductImage";

export function SearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      inputRef.current?.focus();
      storage
        .getWatchlist()
        .then((products) => setTrackedIds(new Set(products.map((p) => p.id))));
    }
  }, [open]);

  const results = searchCatalog(query);

  const handleAdd = async (product: (typeof PRODUCT_CATALOG)[number]) => {
    await storage.addToWatchlist({
      ...product,
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    });
    setTrackedIds((prev) => new Set([...prev, product.id]));
  };

  return (
    <Modal open={open} onClose={onClose} title="Search Products">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Search by name, model, or brand..."
        />
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {results.map((product) => {
          const isTracked = trackedIds.has(product.id);
          return (
            <div
              key={product.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="flex items-center">
                <ProductImage productId={product.id} />
                <div>
                  <div className="font-medium text-sm">{product.name}</div>
                  <div className="text-xs text-gray-500">
                    {product.brand} · {product.category}
                  </div>
                </div>
              </div>
              {isTracked ? (
                <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                  <Check className="w-4 h-4" /> Tracked
                </span>
              ) : (
                <button
                  onClick={() => handleAdd(product)}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>
          );
        })}
        {results.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
            No products found.
          </p>
        )}
      </div>
    </Modal>
  );
}
