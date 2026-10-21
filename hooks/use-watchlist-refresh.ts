import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { log } from "@shared/log";
import { checkPriceDropsNow } from "@/lib/background-price-check";

type Options = {
  watchlistLength: number;
  refreshAll: () => Promise<boolean>;
  reload: () => Promise<void>;
  loadData: () => Promise<void>;
  showAlert: (title: string, message: string) => void;
};

export function useWatchlistRefresh({
  watchlistLength,
  refreshAll,
  reload,
  loadData,
  showAlert,
}: Options) {
  const [checking, setChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const checkingRef = useRef(false);

  const handleRefreshAll = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ok = await refreshAll();
    if (!ok) {
      showAlert(
        "Couldn't refresh prices",
        "The server is unreachable. Showing saved prices.",
      );
    }
  }, [refreshAll, showAlert]);

  const handleCheckNow = useCallback(async () => {
    if (checkingRef.current || watchlistLength === 0) return;
    checkingRef.current = true;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setChecking(true);
    setCheckProgress({ current: 0, total: watchlistLength });
    try {
      await checkPriceDropsNow((current, total) => {
        setCheckProgress({ current, total });
      });
      await reload();
      await refreshAll();
      await loadData();
    } catch (e) {
      log.error("[Watchlist] check now failed", e);
      showAlert("Check failed", "We couldn't check prices. Please try again.");
    } finally {
      checkingRef.current = false;
      setChecking(false);
      setCheckProgress(null);
    }
  }, [watchlistLength, reload, refreshAll, loadData, showAlert]);

  return { checking, checkProgress, handleRefreshAll, handleCheckNow };
}
