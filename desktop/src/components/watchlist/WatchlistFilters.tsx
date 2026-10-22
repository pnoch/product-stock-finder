import type { TagDefinition, WatchlistGroup } from "../../../../lib/types";
import type { FilterKey } from "../../hooks/use-watchlist-view";
import { WatchlistSummaryCard } from "./WatchlistSummaryCard";
import { WatchlistFilterControls } from "./WatchlistFilterControls";
import { WatchlistRegionFilter } from "./WatchlistRegionFilter";
import { WatchlistTagFilter } from "./WatchlistTagFilter";
import { WatchlistSearchInput } from "./WatchlistSearchInput";
import { WatchlistListError } from "./WatchlistListError";

export type { FilterKey };

export function WatchlistFilters({
  summary,
  displayCurrency,
  filter,
  onFilterChange,
  inStockOnly,
  onInStockOnlyChange,
  showAcquired,
  onShowAcquiredChange,
  priceMinInput,
  onPriceMinChange,
  priceMaxInput,
  onPriceMaxChange,
  priceInvalid,
  groupMode,
  onGroupModeChange,
  regions,
  regionFilter,
  onRegionChange,
  tagDefinitions,
  selectedTagIds,
  tagMatchMode,
  tagCounts,
  onToggleTag,
  onChangeTagMode,
  onClearTags,
  onManageTags,
  query,
  onQueryChange,
  listError,
  onRetryList,
}: {
  summary: {
    totalValue: number;
    inStock: number;
    backOrder: number;
    outOfStock: number;
    listingCount: number;
  };
  displayCurrency: string;
  filter: FilterKey;
  onFilterChange: (filter: FilterKey) => void;
  inStockOnly: boolean;
  onInStockOnlyChange: (value: boolean) => void;
  showAcquired: boolean;
  onShowAcquiredChange: (value: boolean) => void;
  priceMinInput: string;
  onPriceMinChange: (value: string) => void;
  priceMaxInput: string;
  onPriceMaxChange: (value: string) => void;
  priceInvalid: boolean;
  groupMode: WatchlistGroup;
  onGroupModeChange: (value: WatchlistGroup) => void;
  regions: string[];
  regionFilter: string;
  onRegionChange: (region: string) => void;
  tagDefinitions: Record<string, TagDefinition>;
  selectedTagIds: string[];
  tagMatchMode: "any" | "all";
  tagCounts: Record<string, number>;
  onToggleTag: (tagId: string) => void;
  onChangeTagMode: (mode: "any" | "all") => void;
  onClearTags: () => void;
  onManageTags: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  listError: string | null;
  onRetryList: () => void;
}) {
  return (
    <>
      <WatchlistSummaryCard
        summary={summary}
        displayCurrency={displayCurrency}
        filter={filter}
        onFilterChange={onFilterChange}
      />

      <WatchlistFilterControls
        filter={filter}
        onFilterChange={onFilterChange}
        inStockOnly={inStockOnly}
        onInStockOnlyChange={onInStockOnlyChange}
        showAcquired={showAcquired}
        onShowAcquiredChange={onShowAcquiredChange}
        priceMinInput={priceMinInput}
        onPriceMinChange={onPriceMinChange}
        priceMaxInput={priceMaxInput}
        onPriceMaxChange={onPriceMaxChange}
        priceInvalid={priceInvalid}
        groupMode={groupMode}
        onGroupModeChange={onGroupModeChange}
      />

      <WatchlistRegionFilter
        regions={regions}
        regionFilter={regionFilter}
        onRegionChange={onRegionChange}
      />

      <WatchlistTagFilter
        tagDefinitions={tagDefinitions}
        selectedTagIds={selectedTagIds}
        tagMatchMode={tagMatchMode}
        tagCounts={tagCounts}
        onToggleTag={onToggleTag}
        onChangeTagMode={onChangeTagMode}
        onClearTags={onClearTags}
        onManageTags={onManageTags}
      />

      <WatchlistSearchInput query={query} onQueryChange={onQueryChange} />

      {listError && (
        <WatchlistListError listError={listError} onRetry={onRetryList} />
      )}
    </>
  );
}
