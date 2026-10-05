import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

// Android-only. On other platforms the native module is not registered, so we
// resolve the API to no-ops instead of throwing at import time.
type NativeApi = {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
};

let native: NativeApi | null = null;
if (Platform.OS === "android") {
  try {
    native = requireNativeModule<NativeApi>("PsfForegroundService");
  } catch {
    native = null;
  }
}

export async function startForegroundService(): Promise<void> {
  await native?.start();
}

export async function stopForegroundService(): Promise<void> {
  await native?.stop();
}

export async function isForegroundServiceRunning(): Promise<boolean> {
  return (await native?.isRunning()) ?? false;
}
