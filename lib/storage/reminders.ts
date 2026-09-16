import type { BackOrderReminder } from "../types";
import type { StorageContext } from "./context";

export function createRemindersStorage(ctx: StorageContext) {
  const { adapter, KEYS, notify, enqueue, readList } = ctx;

  // ─── Back-Order Reminders ───────────────────────────────────────────────────

  async function getBackOrderReminders(): Promise<BackOrderReminder[]> {
    return readList<BackOrderReminder>(KEYS.REMINDERS);
  }

  async function persistBackOrderReminders(
    reminders: BackOrderReminder[],
  ): Promise<void> {
    await adapter.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
  }

  async function saveBackOrderReminders(
    reminders: BackOrderReminder[],
  ): Promise<void> {
    await enqueue(KEYS.REMINDERS, () => persistBackOrderReminders(reminders));
  }

  // Enqueued read-modify-write so concurrent callers never lose changes.
  async function updateReminders(
    fn: (
      reminders: BackOrderReminder[],
    ) => Promise<BackOrderReminder[]> | BackOrderReminder[],
  ): Promise<void> {
    await enqueue(KEYS.REMINDERS, async () => {
      const reminders = await getBackOrderReminders();
      const next = await fn(reminders);
      await persistBackOrderReminders(next);
    });
  }

  async function addBackOrderReminder(
    reminder: BackOrderReminder,
  ): Promise<void> {
    await enqueue(KEYS.REMINDERS, async () => {
      const reminders = await getBackOrderReminders();
      // Dedup by (productId, distributorId) as well as id: every "Remind Me"
      // tap mints a new id, so repeated taps used to accumulate duplicate
      // reminders (and duplicate scheduled notifications) for one product.
      const existing = reminders.findIndex(
        (r) =>
          r.id === reminder.id ||
          (r.productId === reminder.productId &&
            r.distributorId === reminder.distributorId),
      );
      if (existing >= 0) {
        reminders[existing] = reminder;
      } else {
        reminders.unshift(reminder);
      }
      await persistBackOrderReminders(reminders);
      notify("reminders", reminder.id);
    });
  }

  async function removeBackOrderReminder(reminderId: string): Promise<void> {
    await enqueue(KEYS.REMINDERS, async () => {
      const reminders = await getBackOrderReminders();
      await persistBackOrderReminders(
        reminders.filter((r) => r.id !== reminderId),
      );
      notify("reminders", reminderId);
    });
  }

  // ─── Back-In-Stock Watches ──────────────────────────────────────────────────

  async function getStockWatches(): Promise<BackOrderReminder[]> {
    return readList<BackOrderReminder>(KEYS.STOCK_WATCHES);
  }

  async function persistStockWatches(watches: BackOrderReminder[]): Promise<void> {
    await adapter.setItem(KEYS.STOCK_WATCHES, JSON.stringify(watches));
  }

  async function saveStockWatches(watches: BackOrderReminder[]): Promise<void> {
    await enqueue(KEYS.STOCK_WATCHES, () => persistStockWatches(watches));
  }

  async function updateStockWatches(
    fn: (
      watches: BackOrderReminder[],
    ) => Promise<BackOrderReminder[]> | BackOrderReminder[],
  ): Promise<void> {
    await enqueue(KEYS.STOCK_WATCHES, async () => {
      const watches = await getStockWatches();
      const next = await fn(watches);
      await persistStockWatches(next);
    });
  }

  async function addStockWatch(watch: BackOrderReminder): Promise<void> {
    await enqueue(KEYS.STOCK_WATCHES, async () => {
      const watches = await getStockWatches();
      const existing = watches.findIndex(
        (w) =>
          w.productId === watch.productId &&
          w.distributorId === watch.distributorId,
      );
      if (existing >= 0) {
        watches[existing] = watch;
      } else {
        watches.unshift(watch);
      }
      await persistStockWatches(watches);
      notify("reminders", watch.id);
    });
  }

  async function removeStockWatch(watchId: string): Promise<void> {
    await enqueue(KEYS.STOCK_WATCHES, async () => {
      const watches = await getStockWatches();
      await persistStockWatches(watches.filter((w) => w.id !== watchId));
      notify("reminders", watchId);
    });
  }

  async function updateStockWatchStatus(
    productId: string,
    distributorId: string,
    status: string,
  ): Promise<void> {
    await enqueue(KEYS.STOCK_WATCHES, async () => {
      const watches = await getStockWatches();
      let targetId: string | null = null;
      const updated = watches.map((w) => {
        if (w.productId === productId && w.distributorId === distributorId) {
          targetId = w.id;
          return { ...w, lastKnownStatus: status };
        }
        return w;
      });
      await persistStockWatches(updated);
      if (targetId) notify("reminders", targetId);
    });
  }

  return {
    getBackOrderReminders,
    saveBackOrderReminders,
    updateReminders,
    addBackOrderReminder,
    removeBackOrderReminder,
    getStockWatches,
    saveStockWatches,
    updateStockWatches,
    addStockWatch,
    removeStockWatch,
    updateStockWatchStatus,
  };
}
