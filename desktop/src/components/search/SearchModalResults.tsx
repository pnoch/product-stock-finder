import { Check, Loader2, Plus, Wand2 } from "lucide-react";
import type { TagDefinition } from "../../../../lib/types";
import { ProductImage } from "../ProductImage";

type SearchProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  modelNumber: string;
};

export function SearchModalResults({
  results,
  trackedIds,
  pendingTags,
  tagDefinitions,
  query,
  discovering,
  discoverError,
  onAssignTags,
  onAdd,
  onDiscover,
}: {
  results: SearchProduct[];
  trackedIds: Set<string>;
  pendingTags: Record<string, string[]>;
  tagDefinitions: Record<string, TagDefinition>;
  query: string;
  discovering: boolean;
  discoverError: { title: string; message: string; retry: boolean } | null;
  onAssignTags: (productId: string) => void;
  onAdd: (product: SearchProduct) => void;
  onDiscover: () => void;
}) {
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {results.map((product) => {
        const isTracked = trackedIds.has(product.id);
        const pending = pendingTags[product.id] ?? [];
        return (
          <div
            key={product.id}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:shadow-sm hover:scale-[1.01] transition-all duration-200"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <ProductImage productId={product.id} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{product.name}</div>
                <div className="text-xs text-gray-500 truncate">
                  {product.brand} · {product.category} · {product.modelNumber}
                </div>
                {Object.keys(tagDefinitions).length > 0 && !isTracked && (
                  <button onClick={() => onAssignTags(product.id)} className="mt-1 text-xs text-brand-600 hover:underline">
                    {pending.length ? `${pending.length} tag${pending.length !== 1 ? "s" : ""} selected` : "Assign tags"}
                  </button>
                )}
                {pending.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pending.map((tid) => {
                      const def = tagDefinitions[tid];
                      if (!def) return null;
                      return <span key={tid} className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: def.color }}>{def.name}</span>;
                    })}
                  </div>
                )}
              </div>
            </div>
            {isTracked ? (
              <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium shrink-0 ml-2">
                <Check className="w-4 h-4" /> Tracked
              </span>
            ) : (
              <button
                onClick={() => onAdd(product)}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors duration-200 cursor-pointer shrink-0 ml-2"
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
              onClick={onDiscover}
              className="mt-4 flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium text-sm hover:bg-brand-500/20 transition-colors duration-200 cursor-pointer"
              aria-label="Discover product with AI"
            >
              <Wand2 className="w-5 h-5" />
              Discover with AI
            </button>
          )}
          {discoverError && (
            <div role="alert" className="mt-4 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-left">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">{discoverError.title}</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{discoverError.message}</p>
              {discoverError.retry && <button onClick={onDiscover} className="mt-2 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700">Retry</button>}
            </div>
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
  );
}
