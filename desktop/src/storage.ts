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
// split-brain divergence between localStorage and those files, prefer the file
// for the watchlist key when Tauri is available, falling back to localStorage
// (e.g. web preview or tests) if the invoke fails.
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
    if (isTauri && key === "watchlist_products") {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const parsed = JSON.parse(value);
        await invoke("write_watchlist", { value: parsed });
      } catch {
        // best-effort — localStorage still updated
      }
    }
  },
  removeItem: async (key: string) => {
    localStorage.removeItem(key);
    if (isTauri && key === "watchlist_products") {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("write_watchlist", { value: [] });
      } catch {}
    }
  },
  multiRemove: async (keys: string[]) => {
    keys.forEach((k) => localStorage.removeItem(k));
    if (isTauri && keys.includes("watchlist_products")) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("write_watchlist", { value: [] });
      } catch {}
    }
  },
};

export const storage = createStorage(isTauri ? tauriAwareAdapter : localStorageAdapter);
