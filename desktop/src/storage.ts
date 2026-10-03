import { createStorage } from "../../lib/storage";
import { log } from "@shared/log";

import { isTauri as detectTauri } from "./lib/tauri";

const isTauri = detectTauri();

let lastMirroredAlerts: Record<string, unknown>[] = [];
let alertsMirrorSeeded = false;

const localStorageAdapter = {
  getItem: async (key: string) => localStorage.getItem(key),
  setItem: async (key: string, value: string) =>
    localStorage.setItem(key, value),
  removeItem: async (key: string) => localStorage.removeItem(key),
  multiRemove: async (keys: string[]) =>
    keys.forEach((k) => localStorage.removeItem(k)),
};

// When running inside Tauri, the Rust backend owns JSON files in app_data_dir
// (see desktop/src-tauri/src/lib.rs read_json_file/write_json_file). To avoid
// split-brain divergence between localStorage and those files, mirror every key
// the Rust side reads (watchlist, alerts, reminders, settings) into the file
// store, falling back to localStorage (web preview/tests) if the invoke fails.
const TAURI_MIRRORED_KEYS = new Set([
  "watchlist_products",
  "price_alerts",
  "back_order_reminders",
  "app_settings",
  // Restock watches: the Rust tray badge counts them and the Rust poller reads
  // them, so UI-created watches must reach the file store (and vice versa).
  "back_in_stock_watches",
  // Live FX rates: the Rust poller converts prices with the same overlay the UI
  // applies (lib/currency.ts), or an alert could fire on one platform only.
  "fx_rates",
]);

async function mirrorToFile(key: string, value: unknown): Promise<void> {
  if (!isTauri || !TAURI_MIRRORED_KEYS.has(key)) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    if (key === "watchlist_products") {
      // Merge rather than overwrite: this array is built from React state and
      // can predate a poller price update, which the wholesale write reverted
      // (see merge_watchlist in the Rust side). The merged array is written back
      // to localStorage so the two stores stay equal.
      const merged = await invoke<string>("merge_watchlist", { value });
      try {
        localStorage.setItem(key, merged);
      } catch {
        // storage disabled/full — the file store is authoritative
      }
      return;
    }
    if (key === "price_alerts") {
      const { computeAlertMutations } = await import("./lib/alert-mutations");
      const next = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      if (!alertsMirrorSeeded) {
        // Seed from disk so a deletion made before the first save is detected.
        const current = await invoke<unknown>("read_value_for_key", { key: "price_alerts" });
        lastMirroredAlerts = Array.isArray(current)
          ? (current as Record<string, unknown>[])
          : [];
        alertsMirrorSeeded = true;
      }
      const { upserts, removes } = computeAlertMutations(lastMirroredAlerts, next);
      if (upserts.length === 0 && removes.length === 0) return;
      const merged = await invoke<string>("apply_alert_mutations", { upserts, removes });
      // Track the renderer's array, not Rust's merged copy: the merged array can
      // carry poller-owned fields the UI never read, which a later diff would
      // otherwise "remove" with a null patch.
      lastMirroredAlerts = next;
      try {
        localStorage.setItem(key, merged);
      } catch {
        // storage disabled/full — the file store is authoritative
      }
      return;
    }
    await invoke("set_value_for_key", { key, value });
  } catch (error) {
    // Best-effort — localStorage still updated — but log the dropped file write
    // so a failed merge/mutation is not entirely silent.
    log.warn("[storage] mirror write failed", key, error);
  }
}

const tauriAwareAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (isTauri && key === "watchlist_products") {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const val = await invoke<unknown>("read_watchlist");
        if (val !== null && val !== undefined) {
          try {
            return JSON.stringify(val);
          } catch {
            return localStorage.getItem(key);
          }
        }
      } catch {
        // fall through to localStorage
      }
    }
    if (isTauri && key === "price_alerts") {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const val = await invoke<unknown>("read_value_for_key", { key: "price_alerts" });
        if (Array.isArray(val)) {
          lastMirroredAlerts = val as Record<string, unknown>[];
          alertsMirrorSeeded = true;
          return JSON.stringify(val);
        }
      } catch {
        // fall through to localStorage
      }
    }
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    localStorage.setItem(key, value);
    // Same-document writes do not fire a `storage` event, so notify listeners
    // (e.g. use-theme) explicitly. Without this, changing the theme in Settings
    // updated the setting but never re-applied the CSS class.
    if (typeof window !== "undefined" && key === "app_settings") {
      window.dispatchEvent(new Event("app_settings:changed"));
    }
    if (isTauri && TAURI_MIRRORED_KEYS.has(key)) {
      try {
        await mirrorToFile(key, JSON.parse(value));
      } catch (error) {
        log.warn("[storage] mirror write failed", key, error);
      }
    }
  },
  removeItem: async (key: string) => {
    localStorage.removeItem(key);
    if (isTauri && TAURI_MIRRORED_KEYS.has(key)) {
      await mirrorToFile(key, key === "watchlist_products" ? [] : null);
    }
  },
  multiRemove: async (keys: string[]) => {
    keys.forEach((k) => localStorage.removeItem(k));
    if (isTauri) {
      for (const key of keys) {
        if (TAURI_MIRRORED_KEYS.has(key)) {
          await mirrorToFile(key, key === "watchlist_products" ? [] : null);
        }
      }
    }
  },
};

export const storage = createStorage(isTauri ? tauriAwareAdapter : localStorageAdapter);
