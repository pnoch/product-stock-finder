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
