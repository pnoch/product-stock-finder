import { useCallback } from "react";
import { LOG_ERROR } from "@shared/log";
import { pickAndImportWatchlistCsv } from "@/lib/watchlist-import";

type Options = {
  isPro: boolean;
  reload: () => Promise<void>;
  loadData: () => Promise<void>;
  showAlert: (title: string, message: string) => void;
  setPaywallVisible: (visible: boolean) => void;
  track: (event: string, props?: Record<string, unknown>) => void;
};

export function useWatchlistImport({
  isPro,
  reload,
  loadData,
  showAlert,
  setPaywallVisible,
  track,
}: Options) {
  const handleImportCsv = useCallback(async () => {
    try {
      const result = await pickAndImportWatchlistCsv({ isPro });
      if (result.status === "canceled") return;
      if (result.status === "empty") {
        showAlert("Import failed", "CSV file is empty.");
        return;
      }
      if (result.status === "invalid") {
        showAlert(
          "Import failed",
          "No valid rows found. Expected header: model,targetPrice,currency,tags",
        );
        return;
      }
      if (result.truncated) {
        showAlert(
          "Large file",
          `Only the first ${result.rows} rows were imported. Split the file and import the rest separately.`,
        );
      }
      await reload();
      await loadData();
      if (result.limited) {
        track("paywall_shown");
        setPaywallVisible(true);
        showAlert(
          "Import limited",
          `Added ${result.added} product${result.added === 1 ? "" : "s"} — upgrade to Pro to import the rest.`,
        );
        return;
      }
      const notes = [
        result.duplicates > 0 ? `${result.duplicates} already tracked` : "",
        result.skipped > 0 ? `${result.skipped} skipped` : "",
      ]
        .filter(Boolean)
        .join(", ");
      showAlert(
        "Import complete",
        `Added ${result.added} product${result.added !== 1 ? "s" : ""}${notes ? `, ${notes}` : ""}.`,
      );
    } catch (e) {
      LOG_ERROR("[Watchlist] import failed", e);
      showAlert("Import failed", e instanceof Error ? e.message : String(e));
    }
  }, [reload, loadData, isPro, showAlert, setPaywallVisible, track]);

  return { handleImportCsv };
}
