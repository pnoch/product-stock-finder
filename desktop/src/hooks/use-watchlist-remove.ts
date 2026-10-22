import { useEffect, useRef, useState } from "react";
import type {
  BackOrderReminder,
  PriceAlert,
  Product,
} from "../../../lib/types";
import { storage } from "../storage";

type Options = {
  products: Product[];
  selectedIds: Set<string>;
  exitSelection: () => void;
  refresh: () => Promise<void>;
  showToast: (message: string) => void;
};

export function useWatchlistRemove({
  products,
  selectedIds,
  exitSelection,
  refresh,
  showToast,
}: Options) {
  const [undoProduct, setUndoProduct] = useState<Product | null>(null);
  const undoAlertsRef = useRef<PriceAlert[]>([]);
  const undoRemindersRef = useRef<BackOrderReminder[]>([]);
  const undoWatchesRef = useRef<BackOrderReminder[]>([]);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showUndoBar = (
    product: Product,
    alerts: PriceAlert[] = [],
    reminders: BackOrderReminder[] = [],
    watches: BackOrderReminder[] = [],
  ) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoAlertsRef.current = alerts;
    undoRemindersRef.current = reminders;
    undoWatchesRef.current = watches;
    setUndoProduct(product);
    undoTimer.current = setTimeout(() => setUndoProduct(null), 5000);
  };

  const handleUndo = async () => {
    if (!undoProduct) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    try {
      await storage.addToWatchlist(undoProduct);
      // Restore everything the removal cascade deleted, not just the alerts.
      for (const alert of undoAlertsRef.current) {
        await storage.addAlert(alert);
      }
      for (const reminder of undoRemindersRef.current) {
        await storage.addBackOrderReminder(reminder);
      }
      for (const watch of undoWatchesRef.current) {
        await storage.addStockWatch(watch);
      }
      undoAlertsRef.current = [];
      undoRemindersRef.current = [];
      undoWatchesRef.current = [];
      setUndoProduct(null);
      await refresh();
      showToast("Restored " + undoProduct.name);
    } catch {
      showToast("Couldn't restore that product. Please try again.");
    }
  };

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const handleRemove = async (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    const product = products.find((p) => p.id === productId);
    if (!window.confirm("Remove this product from your watchlist?")) return;
    try {
      // Capture everything the removal cascade will delete so Undo can restore
      // it (otherwise undo silently loses the product's alerts, reminders, and
      // restock watches).
      const [allAlerts, allReminders, allWatches] = await Promise.all([
        storage.getAlerts(),
        storage.getBackOrderReminders(),
        storage.getStockWatches(),
      ]);
      const removedAlerts = allAlerts.filter((a) => a.productId === productId);
      const removedReminders = allReminders.filter(
        (r) => r.productId === productId,
      );
      const removedWatches = allWatches.filter(
        (w) => w.productId === productId,
      );
      await storage.removeFromWatchlist(productId);
      await refresh();
      if (product) {
        showUndoBar(product, removedAlerts, removedReminders, removedWatches);
      } else {
        showToast("Removed from watchlist");
      }
    } catch {
      showToast("Couldn't remove that product. Please try again.");
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Remove ${ids.length} product${ids.length !== 1 ? "s" : ""} from watchlist?`,
      )
    )
      return;
    try {
      for (const id of ids) await storage.removeFromWatchlist(id);
      await refresh();
      exitSelection();
      showToast(
        `Removed ${ids.length} product${ids.length !== 1 ? "s" : ""}`,
      );
    } catch {
      showToast("Couldn't remove those products. Please try again.");
    }
  };

  return {
    undoProduct,
    setUndoProduct,
    handleUndo,
    handleRemove,
    handleBulkDelete,
  };
}
