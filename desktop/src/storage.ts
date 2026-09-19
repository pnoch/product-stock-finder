import { createStorage } from "../../lib/storage";

const isTauri = typeof window !== "undefined" && (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined;

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
]);

async function mirrorToFile(key: string, value: unknown): Promise<void> {
  if (!isTauri || !TAURI_MIRRORED_KEYS.has(key)) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_value_for_key", { key, value });
  } catch {
    // best-effort — localStorage still updated
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
      } catch {
        // non-JSON value — nothing to mirror
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
