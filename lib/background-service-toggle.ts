import { enableBackgroundService, disableBackgroundService } from "./background-service";
import { isOverlayGranted, requestOverlay } from "@/modules/psf-webview-renderer";

// Keeps the native side in sync with the persisted toggle value. Background
// rendering needs the overlay permission, so prompt for it when enabling.
export async function applyBackgroundServiceToggle(enabled: boolean): Promise<void> {
  if (enabled) {
    try {
      if (!(await isOverlayGranted())) await requestOverlay();
    } catch {
      // module unavailable — foreground rendering still works
    }
    await enableBackgroundService();
  } else {
    await disableBackgroundService();
  }
}
