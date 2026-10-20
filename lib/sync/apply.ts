import { log } from "@shared/log";
import type { Storage } from "@/lib/storage";
import type {
  AppSettings,
  BackOrderReminder,
  Collection,
  PriceAlert,
  Product,
} from "@/lib/types";
import { PRICE_HISTORY_DAYS } from "@/shared/const";
import { mergePriceHistory } from "@/lib/price-history";
import {
  applyLocalLlmKey,
  stripDeviceLocalSettings,
} from "@/lib/settings-privacy";
import { sanitizePulledItem } from "./serialize";

export async function applyLocalItem(
  storage: Storage,
  collection: Collection,
  data: unknown,
): Promise<void> {
  const sanitized = sanitizePulledItem(collection, data);
  if (sanitized === null) {
    log.warn(`[Sync] dropped malformed pulled ${collection} item`);
    return;
  }
  data = sanitized;
  switch (collection) {
    case "watchlist": {
      const incoming = data as Product;
      await storage.updateWatchlist((list) => {
        const existing = list.find((p) => p.id === incoming.id);
        if (!existing) {
          return [...list, { ...incoming, isWatched: true }];
        }
        return list.map((p) => {
          if (p.id !== incoming.id) return p;
          // Defensive `?? []`: a corrupt/legacy product can lack `listings`,
          // and a throw here aborts the whole sync (not just this item).
          const incomingListings = incoming.listings ?? [];
          const existingListings = existing.listings ?? [];
          const incomingIds = new Set(
            incomingListings.map((l) => l.distributorId),
          );
          const merged = incomingListings.map((l) => {
            const local = existingListings.find(
              (el) => el.distributorId === l.distributorId,
            );
            return local
              ? {
                  ...l,
                  priceHistory: mergePriceHistory(
                    local.priceHistory ?? [],
                    l.priceHistory ?? [],
                    PRICE_HISTORY_DAYS,
                  ),
                }
              : l;
          });
          const localOnly = existingListings.filter(
            (el) => !incomingIds.has(el.distributorId),
          );
          // Tags carry their own timestamp: they must survive a listings-only
          // refresh, but a plain union made a removal impossible to propagate
          // (the newer side always re-added the tag). When neither side has a
          // stamp (legacy data) fall back to the union, which at least keeps a
          // local addition.
          const incomingStamp = incoming.tagsUpdatedAt;
          const existingStamp = existing.tagsUpdatedAt;
          let tags: string[] | undefined;
          let tagsUpdatedAt: string | undefined;
          if (!incomingStamp && !existingStamp) {
            const union = Array.from(
              new Set([...(incoming.tags ?? []), ...(existing.tags ?? [])]),
            );
            tags = union.length > 0 ? union : undefined;
          } else if (
            // Parsed-time comparison: a stamp can arrive from an arbitrary
            // client via sync, so it is not guaranteed canonical — and
            // `"…:00.500Z" >= "…:00Z"` is false lexically though later.
            (Date.parse(incomingStamp ?? "") || 0) >=
            (Date.parse(existingStamp ?? "") || 0)
          ) {
            tags = incoming.tags;
            tagsUpdatedAt = incomingStamp;
          } else {
            tags = existing.tags;
            tagsUpdatedAt = existingStamp;
          }
          return {
            ...incoming,
            listings: [...merged, ...localOnly],
            tags,
            tagsUpdatedAt,
          };
        });
      });
      break;
    }
    case "alerts": {
      const incoming = data as PriceAlert;
      await storage.updateAlerts((alerts) => {
        const existing = alerts.find((a) => a.id === incoming.id);
        if (existing) {
          return alerts.map((a) => (a.id === incoming.id ? incoming : a));
        }
        return [...alerts, incoming];
      });
      break;
    }
    case "reminders": {
      const incoming = data as BackOrderReminder;
      const targetWatches = incoming.reminderType === "back_in_stock";
      if (targetWatches) {
        await storage.updateStockWatches((watches) => {
          const existing = watches.find((w) => w.id === incoming.id);
          return existing
            ? watches.map((w) => (w.id === incoming.id ? incoming : w))
            : [...watches, incoming];
        });
      } else {
        await storage.updateReminders((reminders) => {
          const existing = reminders.find((r) => r.id === incoming.id);
          return existing
            ? reminders.map((r) => (r.id === incoming.id ? incoming : r))
            : [...reminders, incoming];
        });
      }
      break;
    }
    case "settings": {
      // Per-field merge: settings is a single row, so a whole-row overwrite
      // loses a field another device changed while this one was offline. Using
      // the last-synced snapshot as the base, keep the local value for any
      // field the local device changed since that snapshot and take the
      // incoming value otherwise. Without a snapshot (first sync after
      // upgrade) there is no base, so fall back to whole-row LWW.
      const incoming = data as AppSettings;
      const base = (await storage.getSyncMeta()).settingsSnapshot;
      const local = await storage.getSettings();
      if (!base) {
        // First sync after upgrade: no base to merge against, but this device's
        // API key must survive (an older server row may still carry one).
        await storage.saveSettings(
          applyLocalLlmKey({ ...stripDeviceLocalSettings(incoming) }, local),
        );
        break;
      }
      const merged: AppSettings = { ...incoming };
      for (const key of Object.keys(local) as (keyof AppSettings)[]) {
        const localChanged =
          JSON.stringify(local[key]) !== JSON.stringify(base[key]);
        if (localChanged) {
          (merged as unknown as Record<string, unknown>)[key] = local[key];
        }
      }
      // A key the local device *removed* (e.g. Quiet Hours turned off, which
      // drops the key) is absent from `local`, so the loop above never sees it
      // and the incoming value would resurrect it. If the key existed in the
      // last-synced base but is gone locally, the local removal wins.
      for (const key of Object.keys(base) as (keyof AppSettings)[]) {
        if (key in local) continue;
        delete (merged as unknown as Record<string, unknown>)[key];
      }
      await storage.saveSettings(applyLocalLlmKey(merged, local));
      break;
    }
  }
}

export async function removeLocalItem(
  storage: Storage,
  collection: Collection,
  id: string,
): Promise<void> {
  switch (collection) {
    case "watchlist": {
      // Use the storage primitive (not a bare updateWatchlist) so the cascade
      // to this product's alerts runs: a product deleted on another device must
      // not leave orphaned alerts here that can never fire.
      await storage.removeFromWatchlist(id);
      break;
    }
    case "alerts": {
      await storage.updateAlerts((alerts) =>
        alerts.filter((a) => a.id !== id),
      );
      break;
    }
    case "reminders": {
      // Use the storage primitives so a removed reminder/watch also cancels its
      // scheduled OS notification (a bare update* filter left it scheduled).
      await storage.removeReminderById(id);
      await storage.removeStockWatchById(id);
      break;
    }
    case "settings":
      break;
  }
}

export async function itemExists(
  storage: Storage,
  collection: Collection,
  id: string,
): Promise<boolean> {
  switch (collection) {
    case "watchlist":
      return (await storage.getWatchlist()).some((p) => p.id === id);
    case "alerts":
      return (await storage.getAlerts()).some((a) => a.id === id);
    case "reminders":
      return (
        (await storage.getBackOrderReminders()).some((r) => r.id === id) ||
        (await storage.getStockWatches()).some((w) => w.id === id)
      );
    case "settings":
      return true;
  }
}

