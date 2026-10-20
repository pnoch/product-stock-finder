import { useState } from "react";
import { DISTRIBUTORS } from "@shared/distributors";
import type { DistributorListing, Product } from "../../../lib/types";
import { checkNotificationPermission } from "../lib/notification-permission";
import { createStockWatchId } from "../lib/product-detail";
import { storage } from "../storage";

type Options = {
  product: Product | null;
  bestListing: DistributorListing | null | undefined;
  bestDistributor: { name: string } | null | undefined;
  stockWatches: Record<string, boolean>;
  setStockWatches: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  showToast: (message: string) => void;
};

function nextWeek() {
  return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
}

export function useProductReminders({
  product,
  bestListing,
  bestDistributor,
  stockWatches,
  setStockWatches,
  showToast,
}: Options) {
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderDateInput, setReminderDateInput] = useState(nextWeek);
  const [reminderDistributorId, setReminderDistributorId] = useState<
    string | null
  >(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);

  const [inlineReminderDate, setInlineReminderDate] = useState(nextWeek);
  const [inlineReminderDistributorId, setInlineReminderDistributorId] =
    useState<string | null>(null);
  const [inlineReminderError, setInlineReminderError] = useState<string | null>(
    null,
  );

  const openReminderFor = (listing: DistributorListing) => {
    setReminderDistributorId(listing.distributorId);
    setReminderDateInput(nextWeek());
    setReminderError(null);
    setReminderOpen(true);
  };

  const closeReminder = () => {
    setReminderOpen(false);
    setReminderError(null);
  };

  const handleRemindMe = () => {
    if (!product || !bestListing) {
      showToast("No distributor available");
      return;
    }
    setReminderDistributorId(bestListing.distributorId);
    setReminderDateInput(nextWeek());
    setReminderError(null);
    setReminderOpen(true);
  };

  const handleSetReminder = async () => {
    if (!product || savingReminder) return;
    const distributorId = reminderDistributorId ?? bestListing?.distributorId;
    if (!distributorId) {
      showToast("No distributor available");
      return;
    }
    const picked = new Date(reminderDateInput + "T12:00:00");
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (isNaN(picked.getTime()) || picked.getTime() < startOfToday.getTime()) {
      setReminderError("Please select today or a future date.");
      return;
    }
    const granted = await checkNotificationPermission();
    if (!granted) {
      setReminderError("Enable notifications to set reminders.");
      return;
    }
    const dist = DISTRIBUTORS.find((d) => d.id === distributorId);
    setSavingReminder(true);
    try {
      await storage.addBackOrderReminder({
        id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId: product.id,
        productName: product.name,
        distributorId,
        distributorName: dist?.name ?? distributorId,
        reminderDate: picked.toISOString(),
        createdAt: new Date().toISOString(),
        reminderType: "date",
      });
    } catch {
      setReminderError("Couldn't save your reminder. Please try again.");
      return;
    } finally {
      setSavingReminder(false);
    }
    setReminderOpen(false);
    setReminderError(null);
    showToast(
      `Reminder set for ${picked.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`,
    );
  };

  const handleInlineReminder = async () => {
    if (!product || savingReminder) return;
    const distributorId =
      inlineReminderDistributorId ?? bestListing?.distributorId;
    if (!distributorId) {
      showToast("No distributor available");
      return;
    }
    const picked = new Date(inlineReminderDate + "T12:00:00");
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (isNaN(picked.getTime()) || picked.getTime() < startOfToday.getTime()) {
      setInlineReminderError("Please select today or a future date.");
      return;
    }
    const granted = await checkNotificationPermission();
    if (!granted) {
      setInlineReminderError("Enable notifications to set reminders.");
      return;
    }
    const dist = DISTRIBUTORS.find((d) => d.id === distributorId);
    setSavingReminder(true);
    try {
      await storage.addBackOrderReminder({
        id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId: product.id,
        productName: product.name,
        distributorId,
        distributorName: dist?.name ?? distributorId,
        reminderDate: picked.toISOString(),
        createdAt: new Date().toISOString(),
        reminderType: "date",
      });
    } catch {
      setInlineReminderError("Couldn't save your reminder. Please try again.");
      return;
    } finally {
      setSavingReminder(false);
    }
    setInlineReminderError(null);
    showToast(
      `Reminder set for ${picked.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`,
    );
  };

  const handleWatchRestock = async () => {
    if (!product || !bestListing) {
      showToast("No distributor available");
      return;
    }
    if (savingReminder) return;
    const granted = await checkNotificationPermission();
    if (!granted) {
      showToast("Enable notifications to watch for restocks.");
      return;
    }
    setSavingReminder(true);
    try {
      await storage.addStockWatch({
        id: `watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId: product.id,
        productName: product.name,
        distributorId: bestListing.distributorId,
        distributorName: bestDistributor?.name ?? "Unknown",
        reminderDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        reminderType: "back_in_stock",
        lastKnownStatus: bestListing.stockStatus,
      });
    } catch {
      showToast("Couldn't set that restock watch. Please try again.");
      return;
    } finally {
      setSavingReminder(false);
    }
    setStockWatches((prev) => ({
      ...prev,
      [bestListing.distributorId]: true,
    }));
    showToast("Watching for restock");
  };

  const handleToggleListingWatch = async (listing: DistributorListing) => {
    if (!product || savingReminder) return;
    const isWatching = !!stockWatches[listing.distributorId];
    const dist = DISTRIBUTORS.find((d) => d.id === listing.distributorId);
    setSavingReminder(true);
    try {
      if (isWatching) {
        const watches = await storage.getStockWatches();
        const target = watches.find(
          (w) =>
            w.productId === product.id &&
            w.distributorId === listing.distributorId,
        );
        if (target) await storage.removeStockWatch(target.id);
        setStockWatches((prev) => {
          const next = { ...prev };
          delete next[listing.distributorId];
          return next;
        });
        showToast("Stopped watching");
      } else {
        const granted = await checkNotificationPermission();
        if (!granted) {
          showToast("Enable notifications to watch for restocks.");
          return;
        }
        await storage.addStockWatch({
          id: createStockWatchId(),
          productId: product.id,
          productName: product.name,
          distributorId: listing.distributorId,
          distributorName: dist?.name ?? listing.distributorId,
          reminderDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          reminderType: "back_in_stock",
          lastKnownStatus: listing.stockStatus,
        });
        setStockWatches((prev) => ({
          ...prev,
          [listing.distributorId]: true,
        }));
        showToast(
          `Watching ${dist?.name ?? listing.distributorId} for restock`,
        );
      }
    } catch {
      showToast("Couldn't update that restock watch. Please try again.");
    } finally {
      setSavingReminder(false);
    }
  };

  return {
    reminderOpen,
    setReminderOpen,
    reminderDateInput,
    setReminderDateInput,
    reminderDistributorId,
    setReminderDistributorId,
    reminderError,
    savingReminder,
    openReminderFor,
    closeReminder,
    handleRemindMe,
    handleSetReminder,
    inlineReminderDate,
    setInlineReminderDate,
    inlineReminderDistributorId,
    setInlineReminderDistributorId,
    inlineReminderError,
    handleInlineReminder,
    handleWatchRestock,
    handleToggleListingWatch,
  };
}
