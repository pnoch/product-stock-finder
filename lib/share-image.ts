import { Platform, View } from "react-native";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

type CaptureRef = typeof captureRef;

export async function captureAndShareImage(
  viewRef: React.RefObject<View | null>,
  fileName: string,
  capture: CaptureRef = captureRef,
): Promise<boolean> {
  try {
    if (!viewRef.current) return false;
    if (Platform.OS === "web") {
      const dataUrl = await capture(viewRef.current, {
        format: "png",
        result: "data-uri",
      });
      const anchor = document.createElement("a");
      anchor.href = String(dataUrl);
      anchor.download = `${fileName}.png`;
      anchor.click();
      return true;
    }
    const uri = await capture(viewRef.current, {
      format: "png",
      result: "tmpfile",
    });
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(String(uri), { mimeType: "image/png" });
    return true;
  } catch {
    return false;
  }
}
