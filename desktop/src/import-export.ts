import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";

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
    return result;
  }
  return "Import cancelled";
}
