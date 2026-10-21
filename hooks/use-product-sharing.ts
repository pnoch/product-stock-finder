import { useCallback } from "react";
import { Animated, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { LOG_ERROR } from "@shared/log";
import { buildShareText } from "@/lib/price-share";
import { shareText as shareTextCrossPlatform } from "@/lib/share-text";
import { captureAndShareImage } from "@/lib/share-image";
import { hasExportablePriceData, productHistoryToCsv } from "@/lib/csv";
import { exportCsvFile } from "@/lib/csv-export";
import { showAlert } from "@/lib/alert";
import type { DistributorListing, Product } from "@/lib/types";

type Options = {
  id: string;
  product: Product | null;
  listings: DistributorListing[];
  sortedListings: DistributorListing[];
  displayCurrency: string;
  shareRef: React.RefObject<React.ComponentRef<typeof import("react-native").View> | null>;
  shareScale: Animated.Value;
  showToast: (message: string, tone?: "success" | "info") => void;
};

export function useProductSharing({
  id,
  product,
  listings,
  sortedListings,
  displayCurrency,
  shareRef,
  shareScale,
  showToast,
}: Options) {
  const handleShare = useCallback(async () => {
    if (!product || !id) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.sequence([
        Animated.timing(shareScale, {
          toValue: 0.85,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(shareScale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 22,
          bounciness: 8,
        }),
      ]).start();
    }
    const shareText = buildShareText({
      product,
      listings: sortedListings,
      displayCurrency,
      limit: 5,
    });
    // `id` can be a user-supplied model number (CSV import), so encode it or a
    // "/" or space produces a malformed deep link.
    const deepLink = Linking.createURL(`/product/${encodeURIComponent(id)}`, {
      scheme: "productstockfinder",
    });
    const message = `${shareText}\n\n${deepLink}`;
    try {
      const imageShared = await captureAndShareImage(shareRef, `product-${id}`);
      if (imageShared) {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
    } catch (e) {
      LOG_ERROR("[Product] image share failed, falling back to text", e);
    }
    const result = await shareTextCrossPlatform(message, product.name);
    if (result === "dismissed") return;
    if (result === "copied") {
      showToast("Copied to clipboard", "success");
    } else if (result === "failed") {
      showAlert("Share unavailable", "Sharing isn't supported in this browser.");
      return;
    }
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [product, id, sortedListings, displayCurrency, shareRef, shareScale, showToast]);

  const handleExportCsv = useCallback(async () => {
    if (!product) return;
    const exportable = { ...product, listings };
    if (!hasExportablePriceData(exportable)) {
      showAlert(
        "Nothing to export",
        "No price history is available for this product yet.",
      );
      return;
    }
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const fileName = `${product.modelNumber ?? product.id}-history.csv`;
    const ok = await exportCsvFile(productHistoryToCsv(exportable), fileName);
    if (!ok) {
      showAlert(
        "Export unavailable",
        "We couldn't export the price history on this device.",
      );
      return;
    }
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast("Price history exported", "success");
  }, [product, listings, showToast]);

  return { handleShare, handleExportCsv };
}
