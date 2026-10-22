import { useCallback, type RefObject } from "react";
import { buildWatchlistShareText } from "../../../lib/watchlist-share";
import { copyTextWithFallback, saveNodeAsPng } from "../lib/share";
import type { Product } from "../../../lib/types";
import type { MoversWindow } from "../../../lib/watchlist-stats";

export function useStatsActions({
  products,
  displayCurrency,
  days,
  summaryRef,
  showToast,
}: {
  products: Product[] | null;
  displayCurrency: string;
  days: MoversWindow;
  summaryRef: RefObject<HTMLDivElement | null>;
  showToast: (message: string) => void;
}) {
  const handleCopyText = useCallback(async () => {
    const message = buildWatchlistShareText({ watchlist: products ?? [], displayCurrency, days });
    if (await copyTextWithFallback(message)) showToast("Copied to clipboard");
    else showToast("Couldn't copy share text");
  }, [products, displayCurrency, days, showToast]);

  const handleSaveImage = useCallback(async () => {
    if (summaryRef.current) {
      try {
        await saveNodeAsPng(summaryRef.current, "stats-watchlist.png");
        showToast("Stats image saved");
        return;
      } catch {
        showToast("Couldn't save stats image");
      }
    }
  }, [summaryRef, showToast]);

  return { handleCopyText, handleSaveImage };
}
