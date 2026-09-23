import { Platform } from "react-native";
// Classic FS API moved to /legacy in expo-file-system 19; the root-level
// functions are deprecated stubs that throw at runtime.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

/**
 * Hand a CSV string to the platform's save/share surface. Web downloads the
 * file; native writes it to the cache dir and opens the share sheet. Returns
 * false when the platform can't share (or the write fails) so callers can show
 * a fallback message instead of silently doing nothing.
 */
export async function exportCsvFile(
  csv: string,
  fileName: string,
): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      return true;
    }
    const uri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, {
      mimeType: "text/csv",
      dialogTitle: "Export CSV",
    });
    return true;
  } catch {
    return false;
  }
}
