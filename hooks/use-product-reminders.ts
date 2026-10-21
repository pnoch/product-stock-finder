import { useCallback, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { getDistributorById } from "@shared/distributors";
import {
  addBackOrderReminder,
  addStockWatch,
  getStockWatches,
  removeStockWatch,
} from "@/lib/storage";
import {
  cancelNotification,
  ensureNotificationPermission,
  scheduleBackOrderReminder,
  scheduleStockWatchConfirmation,
} from "@/lib/notifications";
import { toggleAnyWatchRecord } from "@/lib/any-watch";
import { showAlert } from "@/lib/alert";
import type { DistributorListing, Product } from "@/lib/types";

type Options = {
  id: string;
  product: Product | null;
  listings: DistributorListing[];
  stockWatches: Record<string, boolean>;
  setStockWatches: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  showToast: (message: string, tone?: "success" | "info") => void;
};

export function useProductReminders({
  id,
  product,
  listings,
  stockWatches,
  setStockWatches,
  showToast,
}: Options) {
  const [reminderListing, setReminderListing] =
    useState<DistributorListing | null>(null);
  const [reminderDate, setReminderDate] = useState(
    () => new Date(Date.now() + 7 * 86400000),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [togglingWatch, setTogglingWatch] = useState(false);

  // Always creates the any-watch (idempotent id `${id}-any`); never removes.
  // Shared by the toggle's create branch and the scope dialog's "Any
  // distributor", which must not toggle off an existing watch.
  const createAnyWatchRecord = useCallback(async () => {
    if (!id) return;
    const granted = await ensureNotificationPermission();
    if (!granted) {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert(
        "Permission Denied",
        Platform.OS === "web"
          ? "Please allow notifications in your browser to watch for restocks."
          : "Please enable notifications to watch for restocks.",
      );
      return;
    }
    await toggleAnyWatchRecord({
      isWatching: false,
      productId: id,
      productName: product?.name ?? "",
      listings,
      addStockWatch,
      removeAnyWatch: async () => {},
    });
    setStockWatches((prev) => ({ ...prev, "*": true }));
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(
      "Watching all distributors — you'll be notified when it's back in stock",
      "success",
    );
  }, [id, product, listings, setStockWatches, showToast]);

  const toggleAnyWatch = useCallback(async () => {
    if (!id || togglingWatch) return;
    setTogglingWatch(true);
    try {
      const action = await toggleAnyWatchRecord({
        isWatching: !!stockWatches["*"],
        productId: id,
        productName: product?.name ?? "",
        listings,
        addStockWatch,
        removeAnyWatch: async () => {},
      });
      setStockWatches((prev) => ({ ...prev, "*": action === "created" }));
      if (Platform.OS !== "web") {
        if (action === "created")
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      showToast(
        action === "created"
          ? "Watching all distributors — you'll be notified when it's back in stock"
          : "Stopped watching all distributors",
        action === "created" ? "success" : "info",
      );
    } catch {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Couldn't update watch", "Please try again.");
    } finally {
      setTogglingWatch(false);
    }
  }, [id, product, listings, setStockWatches, stockWatches, showToast, togglingWatch]);

  const handleToggleStockWatch = useCallback(
    async (listing: DistributorListing) => {
      if (!id || togglingWatch) return;
      const isWatched = stockWatches[listing.distributorId];
      setTogglingWatch(true);
      if (isWatched) {
        try {
          const watches = await getStockWatches();
          const watch = watches.find(
            (w) =>
              w.productId === id &&
              w.distributorId === listing.distributorId,
          );
          if (watch) {
            if (watch.notificationId)
              await cancelNotification(watch.notificationId);
            await removeStockWatch(watch.id);
          }
          setStockWatches((prev) => ({
            ...prev,
            [listing.distributorId]: false,
          }));
          if (Platform.OS !== "web")
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          showToast("Removed from restock watches", "info");
        } catch {
          if (Platform.OS !== "web")
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Error,
            );
          showAlert(
            "Couldn't remove watch",
            "We couldn't remove that restock watch. Please try again.",
          );
        }
        setTogglingWatch(false);
        return;
      }

      const granted = await ensureNotificationPermission();
      if (!granted) {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert(
          "Permission Denied",
          Platform.OS === "web"
            ? "Please allow notifications in your browser to watch for restocks."
            : "Please enable notifications to watch for restocks.",
        );
        setTogglingWatch(false);
        return;
      }

      const createDistributorWatch = async () => {
        setTogglingWatch(true);
        try {
          const distributor = getDistributorById(listing.distributorId);
          const notificationId = await scheduleStockWatchConfirmation(
            product?.name ?? "Product",
            distributor?.name ?? listing.distributorId,
          );
          await addStockWatch({
            id: `${id}-${listing.distributorId}`,
            productId: id,
            productName: product?.name ?? "",
            distributorId: listing.distributorId,
            distributorName: distributor?.name ?? "",
            reminderDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            reminderType: "back_in_stock",
            scope: "distributor",
            lastKnownStatus: listing.stockStatus,
            notificationId: notificationId ?? undefined,
          });
          setStockWatches((prev) => ({
            ...prev,
            [listing.distributorId]: true,
          }));
          if (Platform.OS !== "web")
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
          showToast(
            "Reminder set — you'll be notified when back in stock",
            "success",
          );
        } catch {
          if (Platform.OS !== "web")
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Error,
            );
          showAlert(
            "Couldn't set watch",
            "We couldn't save that restock watch. Please try again.",
          );
        } finally {
          setTogglingWatch(false);
        }
      };

      // Hold the double-open guard while the non-blocking dialog is up; each
      // create closure and the Cancel button release it.
      showAlert(
        "Watch for restock",
        `Get notified when ${product?.name ?? "this product"} is back in stock.`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setTogglingWatch(false),
          },
          {
            text: "This distributor",
            onPress: () => void createDistributorWatch(),
          },
          {
            text: "Any distributor",
            onPress: () => {
              setTogglingWatch(false);
              void (async () => {
                try {
                  await createAnyWatchRecord();
                } catch {
                  if (Platform.OS !== "web")
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Error,
                    );
                  showAlert(
                    "Couldn't set watch",
                    "We couldn't save that restock watch. Please try again.",
                  );
                }
              })();
            },
          },
        ],
      );
    },
    [
      id,
      product,
      setStockWatches,
      stockWatches,
      showToast,
      togglingWatch,
      createAnyWatchRecord,
    ],
  );

  const handleSetReminder = useCallback(async () => {
    const listing = reminderListing;
    if (!id || !listing) return;
    const granted = await ensureNotificationPermission();
    if (!granted) {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert(
        "Permission Denied",
        Platform.OS === "web"
          ? "Please allow notifications in your browser to set reminders."
          : "Please enable notifications in your device settings to set reminders.",
      );
      return;
    }
    try {
      const distributor = getDistributorById(listing.distributorId);
      const notifId = await scheduleBackOrderReminder(
        product?.name ?? "Product",
        distributor?.name ?? listing.distributorId,
        reminderDate,
        id,
      );
      const { replacedNotificationId } = await addBackOrderReminder({
        id: `reminder-${id}-${listing.distributorId}-${Date.now()}`,
        productId: id,
        productName: product?.name ?? "",
        distributorId: listing.distributorId,
        distributorName: distributor?.name ?? "",
        reminderDate: reminderDate.toISOString(),
        notificationId: notifId ?? undefined,
        createdAt: new Date().toISOString(),
        reminderType: "date",
      });
      // Cancel the notification of the reminder this one replaced, or it still
      // fires on the old date and can no longer be cancelled.
      if (replacedNotificationId) {
        await cancelNotification(replacedNotificationId).catch(() => {});
      }
      setReminderListing(null);
      setShowDatePicker(false);
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(
        `Reminder set for ${reminderDate.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`,
        "success",
      );
    } catch {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert(
        "Couldn't set reminder",
        "We couldn't save your reminder. Please try again.",
      );
    }
  }, [id, product, reminderListing, reminderDate, showToast]);

  return {
    reminderListing,
    setReminderListing,
    reminderDate,
    setReminderDate,
    showDatePicker,
    setShowDatePicker,
    togglingWatch,
    createAnyWatchRecord,
    toggleAnyWatch,
    handleToggleStockWatch,
    handleSetReminder,
  };
}
