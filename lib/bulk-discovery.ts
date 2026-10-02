import {
  rediscoverProduct,
  type DiscoverFn,
  type RediscoverStorage,
} from "./manual-add";

export interface BulkDiscoveryItem {
  productId: string;
  modelNumber: string;
}

export const DEFAULT_BULK_BATCH_SIZE = 3;

export async function runDiscoveryBatch(deps: {
  items: BulkDiscoveryItem[];
  startIndex: number;
  batchSize?: number;
  storage: RediscoverStorage;
  discover: DiscoverFn;
  onProgress?: (done: number, total: number, modelNumber: string) => void;
  shouldCancel?: () => boolean;
}): Promise<{ nextIndex: number; discovered: number }> {
  const {
    items,
    startIndex,
    batchSize = DEFAULT_BULK_BATCH_SIZE,
    storage,
    discover,
    onProgress,
    shouldCancel,
  } = deps;
  const total = items.length;
  const start = Math.max(0, Math.min(startIndex, total));
  let nextIndex = start;
  let discovered = 0;
  const end = Math.min(start + Math.max(0, batchSize), total);
  while (nextIndex < end) {
    if (shouldCancel?.()) break;
    const item = items[nextIndex]!;
    try {
      const result = await rediscoverProduct({
        storage,
        discover,
        productId: item.productId,
        modelNumber: item.modelNumber,
      });
      discovered += result.discovered;
    } catch {
      // Best-effort: a failed model is skipped; the repair CTA retries later.
    }
    nextIndex += 1;
    onProgress?.(nextIndex, total, item.modelNumber);
  }
  return { nextIndex, discovered };
}

/**
 * Drains `runDiscoveryBatch` across the whole list, asking before each
 * follow-up batch. `confirmContinue(remaining)` is called only when a batch
 * leaves models behind; return false to stop and leave them for the repair CTA.
 */
export async function runDiscoveryLoop(deps: {
  items: BulkDiscoveryItem[];
  batchSize?: number;
  storage: RediscoverStorage;
  discover: DiscoverFn;
  onProgress?: (done: number, total: number, modelNumber: string) => void;
  shouldCancel?: () => boolean;
  confirmContinue?: (remaining: number) => boolean;
}): Promise<{ nextIndex: number; discovered: number }> {
  const { items, batchSize, storage, discover, onProgress, shouldCancel, confirmContinue } = deps;
  let nextIndex = 0;
  let discovered = 0;
  while (nextIndex < items.length) {
    const res = await runDiscoveryBatch({
      items,
      startIndex: nextIndex,
      batchSize,
      storage,
      discover,
      onProgress,
      shouldCancel,
    });
    nextIndex = res.nextIndex;
    discovered += res.discovered;
    const remaining = items.length - nextIndex;
    if (remaining > 0 && confirmContinue && !confirmContinue(remaining)) break;
  }
  return { nextIndex, discovered };
}
