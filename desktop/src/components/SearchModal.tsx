import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Check, Plus, Wand2, Loader2 } from "lucide-react";
import { searchCatalog, PRODUCT_CATALOG } from "@shared/catalog";
import { storage } from "../storage";
import { Modal } from "./Modal";
import { ProductImage } from "./ProductImage";
import { discoverProduct } from "../../../lib/llm-discovery";

export function SearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const [discovering, setDiscovering] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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
    try {
      await storage.addToWatchlist({
        ...product,
        addedAt: new Date().toISOString(),
        isWatched: true,
        listings: [],
      });
      setTrackedIds((prev) => new Set([...prev, product.id]));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add to watchlist";
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDiscover = useCallback(async () => {
    if (!query.trim() || discovering) return;
    setDiscovering(true);
    try {
      const result = await discoverProduct(query);
      if (result) {
        storage.addToWatchlist({
          ...result.product,
          addedAt: new Date().toISOString(),
          isWatched: true,
          listings: [],
        });
        onClose();
      } else {
        alert("Discovery Failed: Could not find product information. Try a more specific search.");
      }
    } finally {
      setDiscovering(false);
    }
  }, [query, discovering, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="Search Products">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
          placeholder="Search by name, model, or brand..."
          aria-label="Search products by name, model, or brand"
        />
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {results.map((product) => {
          const isTracked = trackedIds.has(product.id);
          return (
            <div
              key={product.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:shadow-sm hover:scale-[1.01] transition-all duration-200 cursor-pointer"
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
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors duration-200 cursor-pointer"
                  aria-label={`Add ${product.name} to watchlist`}
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>
          );
        })}
        {results.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No products found.
            </p>
            {query.trim().length > 0 && !discovering && (
              <button
                onClick={handleDiscover}
                className="mt-4 flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium text-sm hover:bg-brand-500/20 transition-colors duration-200 cursor-pointer"
                aria-label="Discover product with AI"
              >
                <Wand2 className="w-5 h-5" />
                Discover with AI
              </button>
            )}
            {discovering && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Discovering product...
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium shadow-lg" role="alert">
          {toast}
        </div>
      )}
    </Modal>
  );
}
