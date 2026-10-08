import type { CriterionWatch } from "../types";
import type { StorageContext } from "./context";

export function createCriterionWatchesStorage(ctx: StorageContext) {
  // Deliberately no `notify()`: criterion watches are device-local, not a synced
  // collection (like the per-distributor status map). `notify` takes a synced
  // `Collection` and would push them into sync.
  const { adapter, KEYS, enqueue, readList } = ctx;

  async function getCriterionWatches(): Promise<CriterionWatch[]> {
    return readList<CriterionWatch>(KEYS.CRITERION_WATCHES);
  }

  async function persistCriterionWatches(
    watches: CriterionWatch[],
  ): Promise<void> {
    await adapter.setItem(KEYS.CRITERION_WATCHES, JSON.stringify(watches));
  }

  async function addCriterionWatch(watch: CriterionWatch): Promise<void> {
    await enqueue(KEYS.CRITERION_WATCHES, async () => {
      const watches = await getCriterionWatches();
      if (watches.some((w) => w.id === watch.id)) return;
      await persistCriterionWatches([...watches, watch]);
    });
  }

  async function removeCriterionWatch(id: string): Promise<void> {
    await enqueue(KEYS.CRITERION_WATCHES, async () => {
      const watches = await getCriterionWatches();
      await persistCriterionWatches(watches.filter((w) => w.id !== id));
    });
  }

  async function updateCriterionWatches(
    fn: (
      watches: CriterionWatch[],
    ) => Promise<CriterionWatch[]> | CriterionWatch[],
  ): Promise<void> {
    await enqueue(KEYS.CRITERION_WATCHES, async () => {
      const watches = await getCriterionWatches();
      await persistCriterionWatches(await fn(watches));
    });
  }

  return {
    getCriterionWatches,
    addCriterionWatch,
    removeCriterionWatch,
    updateCriterionWatches,
  };
}
