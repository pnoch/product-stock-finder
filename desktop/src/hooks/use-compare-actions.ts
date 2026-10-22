import { useCallback, type RefObject } from "react";
import { formatPrice } from "@shared/currency";
import { getDistributorById } from "@shared/distributors";
import { storage } from "../storage";
import { checkNotificationPermission } from "../lib/notification-permission";
import { buildShareText } from "../../../lib/price-share";
import { priceHistoryToCsv } from "../../../lib/csv";
import { copyTextWithFallback, saveNodeAsPng } from "../lib/share";
import { saveCsv } from "../lib/save-csv";
import type { PriceAlert, Product } from "../../../lib/types";
import type { CompareListing } from "../components/compare/types";

export function useCompareActions({
  id,
  product,
  alertTarget,
  displayCurrency,
  creatingAlert,
  setCreatingAlert,
  sortedListings,
  chartRef,
  showToast,
}: {
  id?: string;
  product: Product | null;
  alertTarget: number | null;
  displayCurrency: string;
  creatingAlert: boolean;
  setCreatingAlert: (creating: boolean) => void;
  sortedListings: CompareListing[];
  chartRef: RefObject<HTMLDivElement | null>;
  showToast: (message: string) => void;
}) {
  const handleCrossAlert = useCallback(async () => {
    if (!id || !product || alertTarget === null || creatingAlert) return;
    const granted = await checkNotificationPermission();
    if (!granted) {
      showToast("Enable notifications to receive price alerts.");
      return;
    }
    const alert: PriceAlert = {
      id: `cross-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: id,
      distributorId: undefined,
      targetPrice: alertTarget,
      currency: displayCurrency,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    setCreatingAlert(true);
    try {
      await storage.addAlert(alert);
    } catch {
      showToast("Couldn't create alert. Please try again.");
      return;
    } finally {
      setCreatingAlert(false);
    }
    showToast(`Alert set below ${formatPrice(alertTarget, displayCurrency)}`);
  }, [id, product, alertTarget, displayCurrency, creatingAlert, setCreatingAlert, showToast]);

  const handleShareCompare = useCallback(async () => {
    if (!product) return;
    const message = `${buildShareText({ product, listings: sortedListings, displayCurrency, limit: 5 })}\n\n${window.location.origin}/#/compare/${product.id}`;
    if (await copyTextWithFallback(message)) showToast("Copied to clipboard");
    else showToast("Couldn't copy share text");
  }, [product, sortedListings, displayCurrency, showToast]);

  const handleSaveImage = useCallback(async () => {
    if (!chartRef.current || !product) return;
    try {
      await saveNodeAsPng(chartRef.current, `compare-${product.id}.png`);
      showToast("Comparison image saved");
    } catch {
      showToast("Couldn't save comparison image");
    }
  }, [product, chartRef, showToast]);

  const handleExportCsv = useCallback(async () => {
    if (!product) return;
    const withHistory = sortedListings.filter(
      (l) => l.priceHistory && l.priceHistory.length > 0,
    );
    if (withHistory.length === 0) {
      showToast("Nothing to export — no price history yet");
      return;
    }
    try {
      const rows = withHistory
        .flatMap((l) =>
          (l.priceHistory ?? []).map((pt) => ({
            ...pt,
            distributor: getDistributorById(l.distributorId)?.name ?? l.distributorId,
          })),
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const csv = priceHistoryToCsv(rows, {
        name: product.name,
        modelNumber: product.modelNumber ?? product.id,
      });
      const fileName = `${product.id}-price-history-${new Date().toISOString().slice(0, 10)}.csv`;
      const result = await saveCsv(fileName, csv);
      if (result.status === "cancelled") return;
      if (result.status === "failed") {
        showToast("Couldn't export the price history");
        return;
      }
      showToast(result.path ? `Exported to ${result.path}` : "Price history exported");
    } catch {
      showToast("Couldn't export the price history");
    }
  }, [product, sortedListings, showToast]);

  const getTrend = (priceHistory: { price: number; date: string }[] | undefined) => {
    if (!priceHistory || priceHistory.length < 2) return "flat";
    const recent = priceHistory[priceHistory.length - 1].price;
    const prev = priceHistory[priceHistory.length - 2].price;
    if (recent < prev) return "down";
    if (recent > prev) return "up";
    return "flat";
  };

  return {
    handleCrossAlert,
    handleShareCompare,
    handleSaveImage,
    handleExportCsv,
    getTrend,
  };
}
