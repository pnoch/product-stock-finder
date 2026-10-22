import { Search } from "lucide-react";

export function WatchlistSearchInput({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search name, brand, model, or category…"
        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
        aria-label="Search watchlist"
      />
    </div>
  );
}
