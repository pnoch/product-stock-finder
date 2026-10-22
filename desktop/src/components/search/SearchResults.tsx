import { Check, Lightbulb, Loader2, Plus, Wand2 } from "lucide-react";
import type { Product, TagDefinition } from "../../../../lib/types";
import { ProductImage } from "../ProductImage";

type SearchProduct = Omit<Product, "addedAt" | "isWatched" | "listings">;

export function SearchResults({
  results,
  trackedIds,
  pendingTags,
  tagDefinitions,
  query,
  searchTagIds,
  discovering,
  discoverError,
  onOpen,
  onAdd,
  onAssignTags,
  onDiscover,
}: {
  results: SearchProduct[];
  trackedIds: Set<string>;
  pendingTags: Record<string, string[]>;
  tagDefinitions: Record<string, TagDefinition>;
  query: string;
  searchTagIds: string[];
  discovering: boolean;
  discoverError: { title: string; message: string; retry: boolean } | null;
  onOpen: (productId: string) => void;
  onAdd: (product: SearchProduct) => void;
  onAssignTags: (productId: string) => void;
  onDiscover: () => void;
}) {
  return (
    <div className="space-y-2">
      {results.map((product) => {
        const isTracked = trackedIds.has(product.id);
        const pending = pendingTags[product.id] ?? [];
        return (
          <div
            key={product.id}
            onClick={() => onOpen(product.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(product.id);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Open ${product.name}`}
            className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <ProductImage productId={product.id} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{product.name}</div>
                <div className="text-xs text-gray-500 truncate">{product.brand} · {product.category} · {product.modelNumber}</div>
                {Object.keys(tagDefinitions).length > 0 && !isTracked && (
                  <button onClick={(e) => { e.stopPropagation(); onAssignTags(product.id); }} className="mt-1 text-xs text-brand-600 hover:underline">{pending.length ? `${pending.length} tag${pending.length !== 1 ? "s" : ""}` : "Assign tags"}</button>
                )}
                {pending.length > 0 && <div className="flex gap-1 mt-1 flex-wrap">{pending.map((tid) => { const d = tagDefinitions[tid]; if (!d) return null; return <span key={tid} className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: d.color }}>{d.name}</span>; })}</div>}
              </div>
            </div>
            {isTracked ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium ml-2"><Check className="w-4 h-4" /> Tracked</span> : <button onClick={(e) => { e.stopPropagation(); onAdd(product); }} className="ml-2 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>}
          </div>
        );
      })}
      {results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500 mb-4">No products found.</p>
          {!query.trim() && searchTagIds.length === 0 && (
            <p className="inline-flex items-center gap-2 px-3.5 py-2.5 mb-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
              Try searching for RTX 4090, Pi 5, CRS326, or AirPods Max
            </p>
          )}
        </div>
      )}
      {query.trim() && (
        <div className="pt-4">
          {discovering ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
              <span className="text-sm text-gray-500">Discovering...</span>
            </div>
          ) : (
            <button
              onClick={onDiscover}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-4 rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-600 text-sm font-medium"
              aria-label="Discover with AI"
            >
              <Wand2 className="w-5 h-5" /> Discover with AI
            </button>
          )}
          {discoverError && (
            <div role="alert" className="mt-4 mx-auto max-w-md p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-left">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">{discoverError.title}</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{discoverError.message}</p>
              {discoverError.retry && <button onClick={onDiscover} className="mt-2 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700">Retry</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
