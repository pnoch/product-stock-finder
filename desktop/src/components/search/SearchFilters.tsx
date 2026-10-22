import type { TagDefinition } from "../../../../lib/types";
import { TagFilterRow } from "../TagFilterRow";
import { CATALOG_SORT_OPTIONS, PillFilterRow, type CatalogSort } from "../search-chrome";

export function SearchFilters({
  tagDefinitions,
  searchTagIds,
  searchTagMode,
  tagCounts,
  onToggleTag,
  onChangeTagMode,
  onClearTags,
  categories,
  selectedCategory,
  onSelectCategory,
  brands,
  selectedBrand,
  onSelectBrand,
  catalogSort,
  onCatalogSort,
  resultCount,
  query,
}: {
  tagDefinitions: Record<string, TagDefinition>;
  searchTagIds: string[];
  searchTagMode: "any" | "all";
  tagCounts: Record<string, number>;
  onToggleTag: (tagId: string) => void;
  onChangeTagMode: (mode: "any" | "all") => void;
  onClearTags: () => void;
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  brands: string[];
  selectedBrand: string | null;
  onSelectBrand: (brand: string | null) => void;
  catalogSort: CatalogSort;
  onCatalogSort: (sort: CatalogSort) => void;
  resultCount: number;
  query: string;
}) {
  return (
    <>
      {Object.keys(tagDefinitions).length > 0 && (
        <TagFilterRow
          tagDefinitions={tagDefinitions}
          selectedTagIds={searchTagIds}
          tagMatchMode={searchTagMode}
          counts={tagCounts}
          onToggleTag={onToggleTag}
          onChangeMode={onChangeTagMode}
          onClearAll={onClearTags}
        />
      )}

      <PillFilterRow label="Category" options={categories} selected={selectedCategory} onSelect={onSelectCategory} />
      <PillFilterRow label="Brand" options={brands} selected={selectedBrand} onSelect={onSelectBrand} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Sort</span>
        {CATALOG_SORT_OPTIONS.map((opt) => {
          const active = catalogSort === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => onCatalogSort(opt.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
              aria-label={`Sort by ${opt.label}`}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
        {(selectedCategory || selectedBrand) && (
          <button onClick={() => { onSelectCategory(null); onSelectBrand(null); }} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 ml-1">Clear</button>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>{resultCount} result{resultCount !== 1 ? "s" : ""}</span>
        {query.trim() && <span className="px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600">{query}</span>}
      </div>

      {searchTagIds.length > 0 && (
        <p className="text-xs text-gray-500 px-1">Tag filter: showing watchlist matches only — clear to see catalog</p>
      )}
    </>
  );
}
