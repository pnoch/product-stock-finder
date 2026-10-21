import { useCallback, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { formatPrice } from "@shared/currency";
import { getDistributorById } from "@shared/distributors";
import { addAlert } from "@/lib/storage";
import {
  ensureNotificationPermission,
  schedulePriceAlert,
} from "@/lib/notifications";
import { showAlert } from "@/lib/alert";
import { suggestAlertPrices } from "@/lib/alert-suggestions";
import type { DistributorListing, PriceAlert, Product } from "@/lib/types";

type Options = {
  id: string;
  product: Product | null;
  listings: DistributorListing[];
  visibleListings: DistributorListing[];
  displayCurrency: string;
  setAlerts: React.Dispatch<React.SetStateAction<PriceAlert[]>>;
  showToast: (message: string, tone?: "success" | "info") => void;
};

export function useProductAlerts({
  id,
  product,
  listings,
  visibleListings,
  displayCurrency,
  setAlerts,
  showToast,
}: Options) {
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertDistributorId, setAlertDistributorId] = useState<string | null>(
    null,
  );
  const [alertDirection, setAlertDirection] = useState<"drop" | "rise">("drop");
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCurrencyOverride, setAlertCurrencyOverride] = useState<
    string | null
  >(null);
  const alertCurrency = alertCurrencyOverride ?? displayCurrency;
  const setAlertCurrency = setAlertCurrencyOverride;
  const [creatingAlert, setCreatingAlert] = useState(false);

  const alertSuggestions = useMemo(
    // Use the live listings, not `product.listings` (which the hook only seeds
    // from storage on load and never re-syncs after a refresh), so the suggested
    // target prices match the chart/sparkline on screen.
    () => suggestAlertPrices(listings ?? [], alertCurrency),
    [listings, alertCurrency],
  );

  const alertDistributors = useMemo(() => {
    const seen = new Map<
      string,
      { id: string; name: string; countryCode: string }
    >();
    for (const listing of visibleListings) {
      if (seen.has(listing.distributorId)) continue;
      const dist = getDistributorById(listing.distributorId);
      seen.set(listing.distributorId, {
        id: listing.distributorId,
        name: dist?.name ?? listing.distributorId,
        countryCode: dist?.countryCode ?? "",
      });
    }
    return [...seen.values()];
  }, [visibleListings]);

  const handleSetBestAlert = useCallback(
    async (listing: DistributorListing, targetPrice: number) => {
      if (!id || creatingAlert) return;
      // Claim the guard before the await: ensureNotificationPermission resolves
      // asynchronously, so a double-tap could start two alert creations.
      setCreatingAlert(true);
      try {
        const granted = await ensureNotificationPermission();
        if (!granted) {
          if (Platform.OS !== "web")
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          showAlert(
            "Permission Denied",
            Platform.OS === "web"
              ? "Please allow notifications in your browser to receive price alerts."
              : "Please enable notifications in your device settings to receive price alerts.",
          );
          return;
        }
        await schedulePriceAlert(
          product?.name ?? "Product",
          targetPrice,
          listing.currency,
          id,
        );
        const alert: PriceAlert = {
          id: `alert-${id}-${listing.distributorId}-${Date.now()}`,
          productId: id,
          distributorId: listing.distributorId,
          targetPrice,
          currency: listing.currency,
          createdAt: new Date().toISOString(),
          isActive: true,
        };
        await addAlert(alert);
        setAlerts((prev) => [...prev, alert]);
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(
          `Alert created — you'll be notified below ${formatPrice(
            targetPrice,
            listing.currency,
          )}`,
          "success",
        );
      } catch {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert(
          "Couldn't create alert",
          "We couldn't save your price alert. Please try again.",
        );
      } finally {
        setCreatingAlert(false);
      }
    },
    [id, product, setAlerts, showToast, creatingAlert],
  );

  const handleSetTarget = useCallback((distributorId: string) => {
    setAlertDistributorId(distributorId);
    setAlertDirection("drop");
    setAlertPrice("");
    setAlertModalVisible(true);
  }, []);

  const handleSetAlert = useCallback(async () => {
    if (!id || creatingAlert) return;
    const price = parseFloat(alertPrice);
    if (!Number.isFinite(price) || price <= 0) {
      showAlert("Invalid Price", "Please enter a valid target price.");
      return;
    }
    setCreatingAlert(true);
    try {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert(
          "Permission Denied",
          Platform.OS === "web"
            ? "Please allow notifications in your browser to receive price alerts."
            : "Please enable notifications in your device settings to receive price alerts.",
        );
        return;
      }
      await schedulePriceAlert(
        product?.name ?? "Product",
        price,
        alertCurrency,
        id,
      );
      const newAlert: PriceAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: id,
        targetPrice: price,
        currency: alertCurrency,
        distributorId: alertDistributorId ?? undefined,
        direction: alertDirection,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      await addAlert(newAlert);
      setAlerts((prev) => [...prev, newAlert]);
      setAlertModalVisible(false);
      setAlertPrice("");
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(
        `Alert set — ${
          alertDistributorId
            ? `${getDistributorById(alertDistributorId)?.name ?? "that distributor"}'s price`
            : "the price"
        } ${alertDirection === "rise" ? "rises above" : "drops below"} ${formatPrice(
          price,
          alertCurrency,
        )}`,
        "success",
      );
    } catch {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert(
        "Couldn't create alert",
        "We couldn't save your price alert. Please try again.",
      );
    } finally {
      setCreatingAlert(false);
    }
  }, [
    id,
    product,
    alertPrice,
    alertCurrency,
    alertDistributorId,
    alertDirection,
    setAlerts,
    showToast,
    creatingAlert,
  ]);

  return {
    alertModalVisible,
    setAlertModalVisible,
    alertDistributorId,
    setAlertDistributorId,
    alertDirection,
    setAlertDirection,
    alertPrice,
    setAlertPrice,
    alertCurrency,
    setAlertCurrency,
    alertSuggestions,
    alertDistributors,
    creatingAlert,
    handleSetBestAlert,
    handleSetTarget,
    handleSetAlert,
  };
}
