import { useCallback, useState } from "react";
import { log } from "@shared/log";
import type { Update } from "@tauri-apps/plugin-updater";
import { useToast } from "../../hooks/use-toast";
import { checkForUpdates } from "../../lib/app-updater";

export function AppUpdatesRow() {
  const { showToast } = useToast();
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [pending, setPending] = useState<Update | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    setStatus(null);
    try {
      const result = await checkForUpdates();
      if (result.kind === "unsupported") {
        setStatus("Update checks run in the desktop app.");
      } else if (result.kind === "none") {
        setStatus("You're on the latest version.");
      } else {
        setPending(result.update);
        setStatus(`Version ${result.version} is available.`);
      }
    } catch (e) {
      setStatus("Couldn't check for updates.");
      log.warn("[Updates] check failed", e);
    } finally {
      setChecking(false);
    }
  }, []);

  const install = useCallback(async () => {
    if (!pending) return;
    setInstalling(true);
    try {
      await pending.downloadAndInstall();
      setPending(null);
      // Windows exits automatically when the installer runs; on macOS/Linux the
      // new bundle applies on the next launch.
      setStatus("Update installed — restart the app to apply.");
      showToast("Update installed");
    } catch (e) {
      setStatus("Update failed to install.");
      log.warn("[Updates] install failed", e);
    } finally {
      setInstalling(false);
    }
  }, [pending, showToast]);

  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <p className="text-sm font-medium">Updates</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {status ?? "Check for a newer desktop release"}
        </p>
      </div>
      {pending ? (
        <button
          onClick={install}
          disabled={installing}
          className="ml-2 shrink-0 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-50"
          aria-label="Install update"
        >
          {installing ? "Installing" : `Install ${pending.version}`}
        </button>
      ) : (
        <button
          onClick={check}
          disabled={checking}
          className="ml-2 shrink-0 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
          aria-label="Check for updates"
        >
          {checking ? "Checking" : "Check"}
        </button>
      )}
    </div>
  );
}

