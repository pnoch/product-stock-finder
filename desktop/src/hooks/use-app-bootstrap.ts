import { useEffect, useRef, useState } from "react";
import { PRODUCT_CATALOG } from "@shared/catalog";
import { SAMPLE_LISTINGS, freshenSampleListings } from "../../../lib/sample-data";
import { maybeSendDigest } from "../../../lib/price-digest";
import { isAutomaticProduct } from "../../../lib/marketplace";
import { setupSync, registerSyncSetup, type SyncSetup } from "../../../lib/sync";
import { setupWebNotifications } from "../../../lib/web-notifications";
import { loadFxRates, maybeRefreshFxRates } from "../../../lib/fx";
import { evaluateBasketAlert } from "../lib/basket-alert";
import { storage } from "../storage";
import { getApiBaseUrl } from "../lib/api-base";
import { runLaunchSequence } from "../lib/launch";
import { createForegroundSyncRetry } from "../lib/sync-retry";
import { cleanupStaleDevices } from "../lib/device-cleanup";
import { backfillLocalHistory } from "../lib/history-sync";
import { syncDesktopNotifications } from "../server-notifications";
import { runHealthProbeIfDue } from "../lib/health-probe";
import { onPricesChecked, onPriceDropsTriggered, startPricePoller } from "../background";
import { createTRPCClient } from "../lib/trpc";

export function useAppBootstrap({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const [trpcClient] = useState(() => createTRPCClient());
  const isAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);
  const syncRef = useRef<SyncSetup | null>(null);

  useEffect(() => {
    syncRef.current = setupSync({
      storage,
      isSignedIn: () => isAuthenticatedRef.current,
      pull: (since, cursor) => trpcClient.sync.pull.query({ since, cursor: cursor ?? null }),
      push: (items) => trpcClient.sync.push.mutate({ items }),
    });
    const unregister = registerSyncSetup(syncRef.current);
    return () => {
      unregister();
      syncRef.current = null;
    };
  }, [trpcClient]);

  useEffect(() => {
    if (isAuthenticated) {
      syncRef.current?.syncNow();
      void cleanupStaleDevices(trpcClient);
      void (async () => {
        try {
          await backfillLocalHistory(trpcClient, await storage.getWatchlist());
        } catch {
          // history backfill is best-effort
        }
      })();
    }
  }, [isAuthenticated, trpcClient]);

  useEffect(() => {
    const onForeground = createForegroundSyncRetry({
      isSignedIn: () => isAuthenticatedRef.current,
      getMeta: () => storage.getSyncMeta(),
      syncNow: () => void syncRef.current?.syncNow(),
    });
    const onVisibility = () => {
      if (document.visibilityState === "visible") void onForeground();
    };
    window.addEventListener("focus", onForeground);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onForeground);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    return setupWebNotifications();
  }, []);

  useEffect(() => {
    void runLaunchSequence({
      storage,
      catalog: PRODUCT_CATALOG,
      sampleListings: SAMPLE_LISTINGS,
      freshen: freshenSampleListings,
      startPoller: startPricePoller,
      getApiBaseUrl,
      loadFx: loadFxRates,
      maybeRefreshFx: maybeRefreshFxRates,
      checkPricesOnce: async () => {
        try {
          const raw = await storage.getWatchlist();
          if (raw.length === 0) return;
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("run_full_price_check", { apiBaseUrl: getApiBaseUrl() });
        } catch {
          // best-effort
        }
      },
    });
  }, []);

  useEffect(() => {
    const unlistenPromise = onPricesChecked(async (results) => {
      try {
        const { recordHealthFromPriceCheck } = await import("../lib/health-probe");
        await recordHealthFromPriceCheck(results ?? []);
      } catch {
        // health recording is non-fatal
      }
      try {
        const { rediscoverMissingListings } = await import("../../../lib/manual-add");
        const { discoverListings } = await import("../../../lib/listing-discovery");
        await rediscoverMissingListings({
          storage: {
            getWatchlist: () => storage.getWatchlist(),
            updateProductListings: (id, listings) =>
              storage.updateProductListings(id, listings),
          },
          discover: discoverListings,
        });
      } catch {
        // discovery is best-effort
      }
      try {
        const { checkRestocks } = await import("../../../lib/restock");
        await checkRestocks(storage, async (title, body) => {
          const { sendDesktopNotification } = await import("../notifications");
          return sendDesktopNotification(title, body, "/alerts");
        });
      } catch {
        // restock failures are non-fatal
      }
      try {
        const settings = await storage.getSettings();
        const frequency = settings.digestFrequency ?? "off";
        if (frequency === "off") return;
        const prevDigest = await storage.getPriceDigestSnapshot();
        const nextDigest = await maybeSendDigest(
          prevDigest,
          (await storage.getWatchlist()).filter(isAutomaticProduct),
          settings,
          await storage.getAlerts(),
          async (title, body) => {
            const { sendDesktopNotification } = await import("../notifications");
            const ok = await sendDesktopNotification(title, body, "/stats");
            if (ok) {
              try {
                await storage.recordNotificationEvent({
                  id: `local-digest-${new Date().toISOString().slice(0, 10)}`,
                  type: "digest",
                  title,
                  body,
                  createdAt: Date.now(),
                });
              } catch {
                // best-effort
              }
            }
            return ok;
          },
        );
        if (nextDigest) await storage.savePriceDigestSnapshot(nextDigest);
      } catch {
        // digest failures are non-fatal
      }
      try {
        await evaluateBasketAlert(storage, async (title, body, route) => {
          const { sendDesktopNotification } = await import("../notifications");
          return sendDesktopNotification(title, body, route);
        });
      } catch {
        // basket alert failures are non-fatal
      }
    }).catch(() => () => {});
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const unlistenPromise = onPriceDropsTriggered(async (events) => {
      for (const e of events ?? []) {
        if (e.alertId) {
          try {
            await storage.deactivateAlert(e.alertId, e.bestPrice);
          } catch {
            // best effort
          }
        }
        try {
          const isRise = Boolean((e as { isRise?: boolean }).isRise);
          await storage.recordNotificationEvent({
            id: `price-drop-${e.productId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: isRise ? "price_rise" : "price_drop",
            title: isRise ? "Price Increase Alert!" : "Price Drop Alert!",
            body: `${e.productName} is now ${e.bestPrice} ${e.currency} (target ${e.targetPrice} ${e.currency})`,
            productId: e.productId,
            triggeredPrice: e.bestPrice,
            currency: e.currency,
            createdAt: Date.now(),
          });
        } catch {
          // recording never breaks the check
        }
      }
    }).catch(() => () => {});
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await runHealthProbeIfDue();
      if (!isAuthenticatedRef.current) return;
      await syncDesktopNotifications();
    };
    void run();
    const timer = setInterval(() => {
      void run();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isAuthenticated]);

  return { trpcClient };
}
