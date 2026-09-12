import { addRecentSearch, parseRecentSearches, MAX_RECENT_SEARCHES } from "../../../lib/recent-searches";

export const RECENT_KEY = "recent_searches";

export function loadRecent(): string[] {
  try {
    return parseRecentSearches(localStorage.getItem(RECENT_KEY)).slice(0, MAX_RECENT_SEARCHES);
  } catch { return []; }
}

export function saveRecent(list: string[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT_SEARCHES))); } catch {}
}

export function recordRecent(query: string): string[] {
  const updated = addRecentSearch(loadRecent(), query);
  if (query.trim()) saveRecent(updated);
  return updated;
}

export type CatalogSort = "relevance" | "name" | "brand" | "price";

export const CATALOG_SORT_OPTIONS: { key: CatalogSort; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "name", label: "Name" },
  { key: "brand", label: "Brand" },
  { key: "price", label: "Price" },
];

export function PillFilterRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mr-1">{label}</span>
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${selected === null ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
        aria-label={`${label} All`}
      >
        All
      </button>
      {options.map((opt) => {
        const active = selected === opt;
        return (
          <button
            key={opt}
            onClick={() => onSelect(active ? null : opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
            aria-label={`${label} ${opt}`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
