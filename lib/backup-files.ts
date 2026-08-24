import { Platform } from "react-native";
// Classic FS API moved to /legacy in expo-file-system 19; the root-level
// functions are deprecated stubs that throw at runtime.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

function backupFileName(): string {
  return `product-stock-finder-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export async function exportBackupFile(json: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = backupFileName();
      anchor.click();
      URL.revokeObjectURL(url);
      return true;
    }
    const uri = `${FileSystem.cacheDirectory}${backupFileName()}`;
    await FileSystem.writeAsStringAsync(uri, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, {
      mimeType: "application/json",
      dialogTitle: "Export Backup",
    });
    return true;
  } catch {
    return false;
  }
}

export async function pickBackupFile(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return await new Promise<string | null>((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return resolve(null);
          const reader = new FileReader();
          reader.onload = () =>
            resolve(typeof reader.result === "string" ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsText(file);
        };
        input.oncancel = () => resolve(null);
        input.click();
      });
    }
    // Some Android providers report backups as octet-stream/text — accept broadly.
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/json", "text/plain", "application/octet-stream"],
    });
    if (result.canceled || result.assets.length === 0) return null;
    return await FileSystem.readAsStringAsync(result.assets[0].uri);
  } catch {
    return null;
  }
}
