import { useCallback } from "react";
import { WatchlistSectionHeader } from "@/components/watchlist/watchlist-section-header";
import { WatchlistRow } from "@/components/watchlist/watchlist-row";
import { isAcquired } from "@/lib/acquired";
import { hasIncompleteDiscovery } from "@/lib/manual-add";
import type { Product, TagDefinition, WatchlistGroup } from "@/lib/types";
import type { DealScore } from "@/lib/deal-score";

type Insight = { atAllTimeLow: boolean; dropStreak: number };

export function useWatchlistRenderers({
  groupMode,
  tagDefinitions,
  selectionMode,
  displayCurrency,
  insightMap,
  dealScoreMap,
  selectedIds,
  findingIds,
  findingProgress,
  alertProductIds,
  handleProductPress,
  handleProductLongPress,
  handleDelete,
  setPickerProduct,
  handleFindPrices,
  handleToggleAcquired,
  handleSwipeAlert,
}: {
  groupMode: WatchlistGroup;
  tagDefinitions: Record<string, TagDefinition>;
  selectionMode: boolean;
  displayCurrency: string;
  insightMap: Map<string, Insight>;
  dealScoreMap: Map<string, DealScore | null>;
  selectedIds: Set<string>;
  findingIds: Set<string>;
  findingProgress: Map<string, { done: number; total: number }>;
  alertProductIds: Set<string>;
  handleProductPress: (product: Product) => void;
  handleProductLongPress: (product: Product) => void;
  handleDelete: (product: Product) => void;
  setPickerProduct: (product: Product) => void;
  handleFindPrices: (product: Product) => void;
  handleToggleAcquired: (product: Product) => Promise<void> | void;
  handleSwipeAlert: (product: Product) => void;
}) {
  const renderSectionHeader = useCallback(
    ({ section }: { section: { key: string; title: string; products: Product[] } }) => (
      <WatchlistSectionHeader
        section={section}
        groupMode={groupMode}
        tagDefinitions={tagDefinitions}
      />
    ),
    [groupMode, tagDefinitions],
  );

  const renderItem = useCallback(
    ({ item }: { item: Product & { _sectionKey?: string } }) => (
      <WatchlistRow
        product={item}
        displayCurrency={displayCurrency}
        selectionMode={selectionMode}
        insight={
          insightMap.has(item.id)
            ? {
                atAllTimeLow: insightMap.get(item.id)!.atAllTimeLow,
                dropStreak: insightMap.get(item.id)!.dropStreak,
              }
            : undefined
        }
        dealScore={dealScoreMap.get(item.id) ?? undefined}
        selected={selectedIds.has(item.id)}
        findingPrices={findingIds.has(item.id)}
        findingProgress={findingProgress.get(item.id)}
        hasIncompleteDiscovery={hasIncompleteDiscovery(item)}
        hasAlert={alertProductIds.has(item.id)}
        isAcquired={isAcquired(item)}
        tagDefinitions={tagDefinitions}
        onPress={() => handleProductPress(item)}
        onLongPress={() => handleProductLongPress(item)}
        onDelete={() => handleDelete(item)}
        onTagPress={() => setPickerProduct(item)}
        onFindPrices={() => handleFindPrices(item)}
        onToggleAcquired={() => void handleToggleAcquired(item)}
        onToggleAlert={() => handleSwipeAlert(item)}
      />
    ),
    [
      selectionMode,
      displayCurrency,
      insightMap,
      dealScoreMap,
      selectedIds,
      findingIds,
      findingProgress,
      tagDefinitions,
      handleProductPress,
      handleProductLongPress,
      handleDelete,
      handleFindPrices,
      handleToggleAcquired,
      handleSwipeAlert,
      alertProductIds,
      setPickerProduct,
    ],
  );

  return { renderSectionHeader, renderItem };
}
