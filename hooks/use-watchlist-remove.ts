import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { log } from "@shared/log";
import {
  addAlert,
  addBackOrderReminder,
  addStockWatch,
  addToWatchlist,
  getAlerts,
  getBackOrderReminders,
  getStockWatches,
  removeFromWatchlist,
} from "@/lib/storage";
import { scheduleBackOrderReminder } from "@/lib/notifications";
import type { BackOrderReminder, PriceAlert, Product } from "@/lib/types";

type UseWatchlistRemoveOptions = {
  selectedIds: Set<string>;
  exitSelection: () => void;
  reload: () => Promise<void>;
  reloadAlerts: () => Promise<void>;
  loadData: () => Promise<void>;
  showAlert: (title: string, message: string) => void;
};

export function useWatchlistRemove({
  selectedIds,
  exitSelection,
  reload,
  reloadAlerts,
  loadData,
  showAlert,
}: UseWatchlistRemoveOptions) {
  const [undoProduct, setUndoProduct] = useState<Product | null>(null);
  const undoAlertsRef = useRef<PriceAlert[]>([]);
  const undoRemindersRef = useRef<BackOrderReminder[]>([]);
  const undoWatchesRef = useRef<BackOrderReminder[]>([]);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showUndoBar = useCallback(
    (
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
    },
    [],
  );

  const removeProductWithUndo = useCallback(
    async (product: Product) => {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      try {
        const [allAlerts, allReminders, allWatches] = await Promise.all([
          getAlerts(),
          getBackOrderReminders(),
          getStockWatches(),
        ]);
        const removedAlerts = allAlerts.filter(
          (a) => a.productId === product.id,
        );
        const removedReminders = allReminders.filter(
          (r) => r.productId === product.id,
        );
        const removedWatches = allWatches.filter(
          (w) => w.productId === product.id,
        );
        await removeFromWatchlist(product.id);
        await reload();
        await reloadAlerts();
        showUndoBar(product, removedAlerts, removedReminders, removedWatches);
      } catch (e) {
        log.error("[Watchlist] remove failed", e);
        showAlert(
          "Remove failed",
          "We couldn't remove that product. Please try again.",
        );
      }
    },
    [reload, reloadAlerts, showAlert, showUndoBar],
  );

  const handleDelete = useCallback(
    (product: Product) => {
      const doRemove = () => void removeProductWithUndo(product);
      if (Platform.OS === "web") {
        if (
          typeof window !== "undefined" &&
          window.confirm(`Remove "${product.name}" from your watchlist?`)
        ) {
          doRemove();
        }
        return;
      }
      Alert.alert(
        "Remove Product",
        `Remove "${product.name}" from your watchlist?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: doRemove },
        ],
      );
    },
    [removeProductWithUndo],
  );

  const handleUndo = useCallback(async () => {
    if (!undoProduct) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoProduct(null);
    try {
      await addToWatchlist(undoProduct);
      for (const alert of undoAlertsRef.current) {
        await addAlert(alert);
      }
      for (const reminder of undoRemindersRef.current) {
        // The cascade cancelled the scheduled notification. Restoring the row
        // with the dead id would leave a reminder that never fires, so
        // re-schedule it (only for a future date) and store the new id.
        let notificationId = reminder.notificationId;
        const when = new Date(reminder.reminderDate);
        if (!Number.isNaN(when.getTime()) && when.getTime() > Date.now()) {
          const notifId = await scheduleBackOrderReminder(
            reminder.productName,
            reminder.distributorName,
            when,
            reminder.productId,
          ).catch(() => null);
          notificationId = notifId ?? undefined;
        }
        await addBackOrderReminder({ ...reminder, notificationId });
      }
      for (const watch of undoWatchesRef.current) {
        await addStockWatch(watch);
      }
      undoAlertsRef.current = [];
      undoRemindersRef.current = [];
      undoWatchesRef.current = [];
      await reload();
      await reloadAlerts();
    } catch (e) {
      log.error("[Watchlist] undo failed", e);
      showAlert(
        "Undo failed",
        "We couldn't restore that product. Please try again.",
      );
    }
  }, [undoProduct, reload, reloadAlerts, showAlert]);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    const count = ids.length;
    const doRemove = async () => {
      try {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        for (const id of ids) await removeFromWatchlist(id);
        await reload();
        exitSelection();
      } catch (e) {
        log.error("[Watchlist] bulk delete failed", e);
        showAlert(
          "Delete Failed",
          "Could not remove some products. Please try again.",
        );
      }
    };
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(
          `Remove ${count} product${count !== 1 ? "s" : ""} from your watchlist?`,
        )
      ) {
        void doRemove();
      }
      return;
    }
    Alert.alert(
      "Remove Products",
      `Remove ${count} product${count !== 1 ? "s" : ""} from your watchlist?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: doRemove },
      ],
    );
  }, [selectedIds, reload, exitSelection, showAlert]);

  const handleBulkTagChanged = useCallback(() => {
    void reload();
    void loadData();
    exitSelection();
  }, [reload, loadData, exitSelection]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  return {
    undoProduct,
    showUndoBar,
    removeProductWithUndo,
    handleDelete,
    handleUndo,
    handleBulkDelete,
    handleBulkTagChanged,
  };
}
