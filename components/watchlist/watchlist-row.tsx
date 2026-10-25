import { memo } from "react";
import { ProductCard } from "@/components/watchlist/product-card";
import { SwipeableCard } from "@/components/watchlist/swipeable-card";
import type { Product, TagDefinition } from "@/lib/types";
import type { DealScore } from "@/lib/deal-score";

type WatchlistRowProps = {
  product: Product;
  displayCurrency: string;
  selectionMode: boolean;
  insight?: { atAllTimeLow: boolean; dropStreak: number };
  dealScore?: DealScore;
  selected: boolean;
  findingPrices: boolean;
  findingProgress?: { done: number; total: number };
  hasIncompleteDiscovery?: boolean;
  hasAlert: boolean;
  isAcquired: boolean;
  tagDefinitions: Record<string, TagDefinition>;
  onPress: () => void;
  onLongPress: () => void;
  onDelete: () => void;
  onTagPress: () => void;
  onFindPrices: () => void;
  onToggleAcquired: () => void;
  onToggleAlert: () => void;
};

export const WatchlistRow = memo(function WatchlistRow({
  product,
  displayCurrency,
  selectionMode,
  insight,
  dealScore,
  selected,
  findingPrices,
  findingProgress,
  hasIncompleteDiscovery,
  hasAlert,
  isAcquired,
  tagDefinitions,
  onPress,
  onLongPress,
  onDelete,
  onTagPress,
  onFindPrices,
  onToggleAcquired,
  onToggleAlert,
}: WatchlistRowProps) {
  return (
    <SwipeableCard
      enabled={!selectionMode}
      onDelete={onDelete}
      onToggleAlert={onToggleAlert}
      onToggleAcquired={onToggleAcquired}
      isAcquired={isAcquired}
      hasAlert={hasAlert}
    >
      <ProductCard
        product={product}
        displayCurrency={displayCurrency}
        selectionMode={selectionMode}
        insight={insight}
        dealScore={dealScore}
        selected={selected}
        onPress={onPress}
        onLongPress={onLongPress}
        onDelete={onDelete}
        onTagPress={onTagPress}
        onFindPrices={onFindPrices}
        findingPrices={findingPrices}
        findingProgress={findingProgress}
        hasIncompleteDiscovery={hasIncompleteDiscovery}
        tagDefinitions={tagDefinitions}
        onToggleAcquired={onToggleAcquired}
      />
    </SwipeableCard>
  );
});
