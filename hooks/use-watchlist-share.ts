import { useCallback } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { LOG_ERROR } from "@shared/log";
import { buildWatchlistShareMessage } from "@/lib/watchlist-share";
import { shareText } from "@/lib/share-text";
import type { Product } from "@/lib/types";

type Options = {
  watchlist: Product[];
  displayCurrency: string;
  isAuthenticated: boolean;
  createShareLink: {
    mutateAsync: (input: Record<string, never>) => Promise<{ shareUrl: string }>;
  };
  showAlert: (title: string, message: string) => void;
};

export function useWatchlistShare({
  watchlist,
  displayCurrency,
  isAuthenticated,
  createShareLink,
  showAlert,
}: Options) {
  const handleShareWatchlist = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Prefer a server /w/ link when signed in so recipients can open the full
      // list; fall back to the local text summary when signed out or offline.
      // Link creation must never break sharing.
      let shareUrl: string | undefined;
      if (isAuthenticated) {
        try {
          const res = await createShareLink.mutateAsync({});
          shareUrl = res.shareUrl;
        } catch {
          shareUrl = undefined;
        }
      }
      const message = buildWatchlistShareMessage({
        shareUrl,
        watchlist,
        displayCurrency,
        days: 30,
        now: Date.now(),
      });
      const result = await shareText(message, "My Watchlist");
      if (result === "copied") {
        showAlert("Copied", "Watchlist copied to your clipboard.");
      } else if (result === "failed") {
        showAlert(
          "Share unavailable",
          "Sharing isn't supported in this browser.",
        );
      }
    } catch (e) {
      LOG_ERROR("[Watchlist] share failed", e);
    }
  }, [watchlist, displayCurrency, isAuthenticated, createShareLink, showAlert]);

  return { handleShareWatchlist };
}
