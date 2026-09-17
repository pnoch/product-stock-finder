import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { storage } from "./storage";

export async function exportWatchlistAsJson(): Promise<string> {
  const content = await invoke<string>("export_watchlist", { format: "json" });

  const filePath = await save({
    defaultPath: "product-stock-finder-export.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (filePath) {
    const encoder = new TextEncoder();
    await writeFile(filePath, encoder.encode(content));
    return `Exported to ${filePath}`;
  }
  return "Export cancelled";
}

export async function importWatchlistFromJson(): Promise<string> {
  const filePath = await open({
    filters: [{ name: "JSON", extensions: ["json"] }],
    multiple: false,
  });

  if (filePath) {
    const bytes = await readFile(filePath as string);
    const content = new TextDecoder().decode(bytes);
    const result = await invoke<string>("import_watchlist", {
      content,
      format: "json",
    });
    // Re-hydrate the renderer store from the imported Rust files. Without this
    // the UI kept its pre-import localStorage copy and the next write mirrored
    // that stale copy back over the import.
    try {
      const { invoke: inv } = await import("@tauri-apps/api/core");
      const [watchlist, alerts, reminders, settings] = await Promise.all([
        inv<unknown>("read_watchlist"),
        inv<unknown>("read_value_for_key", { key: "price_alerts" }),
        inv<unknown>("read_value_for_key", { key: "back_order_reminders" }),
        inv<unknown>("read_value_for_key", { key: "app_settings" }),
      ]);
      if (watchlist) {
        await storage.saveWatchlist(
          (Array.isArray(watchlist) ? watchlist : []) as never,
        );
      }
      if (alerts) await storage.saveAlerts((alerts ?? []) as never);
      if (reminders) {
        await storage.saveBackOrderReminders((reminders ?? []) as never);
      }
      if (settings) await storage.saveSettings(settings as never);
    } catch {
      // best effort — the Rust files are the source of truth for the poller
    }
    return result;
  }
  return "Import cancelled";
}
