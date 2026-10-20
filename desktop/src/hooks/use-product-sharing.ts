import { useCallback } from "react";
import type { DistributorListing, Product } from "../../../lib/types";
import { buildShareText } from "../../../lib/price-share";
import { hasExportablePriceData, productHistoryToCsv } from "../../../lib/csv";
import { saveCsv } from "../lib/save-csv";
import { saveNodeAsPng } from "../lib/share";

type Options = {
  product: Product | null;
  visibleListings: DistributorListing[];
  displayCurrency: string;
  summaryRef: React.RefObject<HTMLDivElement | null>;
  showToast: (message: string) => void;
};

export function useProductSharing({
  product,
  visibleListings,
  displayCurrency,
  summaryRef,
  showToast,
}: Options) {
  const handleShare = async () => {
    if (!product) return;
    const deepLink = `${window.location.origin}/#/product/${product.id}`;
    const shareText = buildShareText({
      product,
      listings: visibleListings,
      displayCurrency,
      limit: 5,
    });
    const message = `${shareText}\n\n${deepLink}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: message,
          url: deepLink,
        });
        showToast("Shared");
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(message);
      showToast("Link copied to clipboard");
    } catch {
      showToast(deepLink);
    }
  };

  const handleExportCsv = async () => {
    if (!product) return;
    if (!hasExportablePriceData(product)) {
      showToast("Nothing to export");
      return;
    }
    const fileName = `${product.modelNumber ?? product.id}-history.csv`;
    const result = await saveCsv(fileName, productHistoryToCsv(product));
    if (result.status === "cancelled") return;
    if (result.status === "failed") {
      showToast("Couldn't export the price history");
      return;
    }
    showToast(
      result.path ? `Exported to ${result.path}` : "Price history exported",
    );
  };

  const handleCopyLink = async () => {
    if (!product) return;
    const deepLink = `${window.location.origin}/#/product/${product.id}`;
    try {
      await navigator.clipboard.writeText(deepLink);
      showToast("Link copied");
    } catch {
      showToast(deepLink);
    }
  };

  const handleSaveImage = useCallback(async () => {
    if (!summaryRef.current || !product) return;
    try {
      await saveNodeAsPng(summaryRef.current, `product-${product.id}.png`);
      showToast("Product image saved");
    } catch {
      showToast("Couldn't save product image");
    }
  }, [product, showToast, summaryRef]);

  return {
    handleShare,
    handleExportCsv,
    handleCopyLink,
    handleSaveImage,
  };
}
