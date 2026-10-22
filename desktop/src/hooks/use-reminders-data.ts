import { useCallback, useEffect, useState } from "react";
import { storage } from "../storage";
import type { BackOrderReminder } from "../../../lib/types";

export function useRemindersData({
  showToast,
}: {
  showToast: (message: string) => void;
}) {
  const [reminders, setReminders] = useState<BackOrderReminder[]>([]);
  const [watches, setWatches] = useState<BackOrderReminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [remindersError, setRemindersError] = useState<string | null>(null);

  const loadReminders = useCallback(async () => {
    setRemindersLoading(true);
    setRemindersError(null);
    try {
      const [r, w] = await Promise.all([
        storage.getBackOrderReminders(),
        storage.getStockWatches(),
      ]);
      setReminders(r);
      setWatches(w);
    } catch (e) {
      setRemindersError(e instanceof Error ? e.message : "Couldn't load reminders");
    } finally {
      setRemindersLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadReminders();
    });
  }, [loadReminders]);

  const handleDeleteReminder = async (id: string) => {
    if (!window.confirm("Cancel this reminder? This cannot be undone.")) return;
    try {
      await storage.removeBackOrderReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch {
      showToast("Couldn't cancel that reminder. Please try again.");
    }
  };

  const handleDeleteWatch = async (id: string) => {
    if (!window.confirm("Stop watching for this restock? This cannot be undone.")) return;
    try {
      await storage.removeStockWatch(id);
      setWatches((prev) => prev.filter((w) => w.id !== id));
    } catch {
      showToast("Couldn't remove that watch. Please try again.");
    }
  };

  return {
    reminders,
    setReminders,
    watches,
    remindersLoading,
    remindersError,
    loadReminders,
    handleDeleteReminder,
    handleDeleteWatch,
  };
}
