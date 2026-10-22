import type { RefObject } from "react";
import { PenLine, Search as SearchIcon, Upload } from "lucide-react";

export function SearchHeader({
  query,
  onQuery,
  recentSearches,
  onRecent,
  onClearRecent,
  onBulkOpen,
  onManualOpen,
  inputRef,
  onEnter,
  discoveredCount,
}: {
  query: string;
  onQuery: (query: string) => void;
  recentSearches: string[];
  onRecent: (query: string) => void;
  onClearRecent: () => void;
  onBulkOpen: () => void;
  onManualOpen: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  onEnter: () => void;
  discoveredCount: number;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Search Products</h1>
        <div className="flex items-center gap-2">
          <button onClick={onBulkOpen} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700"><Upload className="w-4 h-4" /> Bulk Import</button>
          <button onClick={onManualOpen} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700"><PenLine className="w-4 h-4" /> Manual Add</button>
        </div>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input ref={inputRef} value={query} onChange={(e) => onQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) onEnter(); }} placeholder="Search by name, model, or brand..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600" aria-label="Search products" />
      </div>

      {query.length === 0 && recentSearches.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500">Recent:</span>
          {recentSearches.map((q) => <button key={q} onClick={() => onRecent(q)} className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-xs hover:bg-gray-200 dark:hover:bg-gray-600">{q}</button>)}
          <button onClick={onClearRecent} className="text-xs text-gray-400 ml-1">Clear</button>
        </div>
      )}

      {discoveredCount > 0 && <p className="text-xs text-gray-500">{discoveredCount} discovered products included</p>}
    </>
  );
}
