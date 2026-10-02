import { isTauri } from "./tauri";

/**
 * Saves CSV text. In the Tauri app this opens a native save dialog and writes
 * the file; in the browser it triggers a download. Returns false when the user
 * cancels or the save fails. Never throws.
 */
export async function saveCsv(fileName: string, csv: string): Promise<boolean> {
  try {
    if (isTauri()) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const filePath = await save({
        defaultPath: fileName,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!filePath) return false;
      await writeFile(filePath, new TextEncoder().encode(csv));
      return true;
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
