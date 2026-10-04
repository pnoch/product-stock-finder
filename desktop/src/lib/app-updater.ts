import { isTauri } from "./tauri";
import type { Update } from "@tauri-apps/plugin-updater";

export type UpdateCheckResult =
  | { kind: "unsupported" }
  | { kind: "none" }
  | { kind: "available"; update: Update; version: string; notes: string };

/**
 * Checks the Tauri updater endpoint configured in `tauri.conf.json`. The plugin
 * is dynamically imported so it stays out of the main bundle and the browser
 * build never loads it; outside the Tauri webview the caller gets
 * `"unsupported"` (the web build can't self-update).
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!isTauri()) return { kind: "unsupported" };
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return { kind: "none" };
  return {
    kind: "available",
    update,
    version: update.version,
    notes: update.body ?? "",
  };
}
