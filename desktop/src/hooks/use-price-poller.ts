import { useEffect, useRef } from "react";
import { log } from "@shared/log";
import { getApiBaseUrl } from "../lib/api-base";
import { startPricePoller, stopPricePoller } from "../background";
import type { AppSettings } from "../../../lib/types";

export function usePricePoller({
  checkInterval,
  update,
  showToast,
}: {
  checkInterval: AppSettings["checkInterval"] | undefined;
  update: (partial: Partial<AppSettings>) => Promise<void> | void;
  showToast: (message: string) => void;
}) {
  const prevIntervalRef = useRef<string | undefined>(checkInterval);

  useEffect(() => {
    const prev = prevIntervalRef.current;
    prevIntervalRef.current = checkInterval;
    let cancelled = false;
    (async () => {
      if (!checkInterval || checkInterval === "manual") {
        if (prev && prev !== "manual") await stopPricePoller();
        return;
      }
      if (prev && prev !== "manual" && prev !== checkInterval) {
        await stopPricePoller();
      }
      const intervalMinutes = checkInterval === "hourly" ? 60 : 1440;
      try {
        await startPricePoller(intervalMinutes, getApiBaseUrl());
      } catch {
        if (cancelled) return;
        showToast("Couldn't start background checks — reverted to Manual");
        log.error("[Settings] startPricePoller failed, reverting to manual");
        await update({ checkInterval: "manual" });
      }
    })();
    return () => { cancelled = true; };
  }, [checkInterval, showToast, update]);
}
