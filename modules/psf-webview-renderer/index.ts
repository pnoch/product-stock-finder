import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

type NativeApi = {
  render(url: string, waitForSelector: string | null, timeoutMs: number): Promise<string>;
  isOverlayGranted(): Promise<boolean>;
  requestOverlay(): Promise<void>;
};

let native: NativeApi | null = null;
if (Platform.OS === "android") {
  try {
    native = requireNativeModule<NativeApi>("PsfWebViewRenderer");
  } catch {
    native = null;
  }
}

export async function renderOverlay(
  url: string,
  opts?: { waitForSelector?: string; timeoutMs?: number },
): Promise<string> {
  if (!native) throw new Error("overlay renderer unavailable");
  return native.render(url, opts?.waitForSelector ?? null, opts?.timeoutMs ?? 20000);
}

export async function isOverlayGranted(): Promise<boolean> {
  return (await native?.isOverlayGranted()) ?? false;
}

export async function requestOverlay(): Promise<void> {
  await native?.requestOverlay();
}
