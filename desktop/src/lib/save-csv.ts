import { isTauri } from "./tauri";

export type SaveCsvResult =
  | { status: "saved"; path?: string }
  | { status: "cancelled" }
  | { status: "failed" };

/**
 * Saves CSV text. In the Tauri app this opens a native save dialog and writes
 * the file; in the browser it triggers a download. Distinguishes a user cancel
 * (silent) from a real failure (surface an error). Never throws.
 */
export async function saveCsv(fileName: string, csv: string): Promise<SaveCsvResult> {
  try {
    if (isTauri()) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const filePath = await save({
        defaultPath: fileName,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!filePath) return { status: "cancelled" };
      await writeFile(filePath, new TextEncoder().encode(csv));
      return { status: "saved", path: filePath };
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      URL.revokeObjectURL(url);
    }
    return { status: "saved" };
  } catch {
    return { status: "failed" };
  }
}
