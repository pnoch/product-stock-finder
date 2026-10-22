import type { DealScore } from "../../../lib/deal-score";
import { isAcquired } from "../../../lib/acquired";
import type { Product, TagDefinition } from "../../../lib/types";
import { WatchlistRow } from "../components/watchlist/WatchlistRow";

export function createWatchlistRowRenderer({
  displayCurrency,
  selectionMode,
  selectedId,
  selectedIds,
  insightMap,
  dealScores,
  tagDefinitions,
  findingIds,
  onOpen,
  onToggleSelection,
  onFindPrices,
  onToggleAcquired,
  onEditTags,
  onRemove,
}: {
  displayCurrency: string;
  selectionMode: boolean;
  selectedId: string | null;
  selectedIds: Set<string>;
  insightMap: Map<string, { atAllTimeLow: boolean; dropStreak: number }>;
  dealScores: Map<string, DealScore | null>;
  tagDefinitions: Record<string, TagDefinition>;
  findingIds: Set<string>;
  onOpen: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onFindPrices: (product: Product) => void;
  onToggleAcquired: (event: React.MouseEvent, product: Product) => void;
  onEditTags: (product: Product) => void;
  onRemove: (event: React.MouseEvent, productId: string) => void;
}) {
  function renderRow(
    product: Product,
    virtual?: { ref: (el: HTMLTableRowElement | null) => void; index: number },
  ) {
    return (
    <WatchlistRow
      product={product}
      virtual={virtual}
      displayCurrency={displayCurrency}
      selectionMode={selectionMode}
      selectedId={selectedId}
      selectedIds={selectedIds}
      insightMap={insightMap}
      dealScores={dealScores}
      tagDefinitions={tagDefinitions}
      findingIds={findingIds}
      isAcquired={isAcquired}
      onOpen={onOpen}
      onToggleSelection={onToggleSelection}
      onFindPrices={onFindPrices}
      onToggleAcquired={onToggleAcquired}
      onEditTags={onEditTags}
      onRemove={onRemove}
    />
    );
  }

  return renderRow;
}
