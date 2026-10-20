import { isTauri } from "../lib/tauri";
import { saveCsv } from "../lib/save-csv";
import { log } from "@shared/log";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Palette,
  DollarSign,
  Clock,
  Download,
  Upload,
  Trash2,
  Activity,
  Globe,
  Share2,
} from "lucide-react";
import { useSettings } from "../hooks/use-storage";
import { useToast } from "../hooks/use-toast";
import { storage } from "../storage";
import { startPricePoller, stopPricePoller } from "../background";
import { EXCHANGE_RATES, CURRENCY_SYMBOLS } from "@shared/currency";
import {
  exportWatchlistAsJson,
  importWatchlistFromJson,
} from "../import-export";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { SharedLinksList, JoinedSharedList } from "../components/settings/shared-links";
import { ScraperStatusSection } from "../components/settings/scraper-status-section";
import { DeviceManagementSection } from "../components/settings/device-management-section";
import { AboutSection, type BeforeInstallPromptEvent } from "../components/settings/about-section";
import { AccountSection } from "../components/settings/account-section";
import { NotificationSettingsSection } from "../components/settings/notification-settings-section";
import { LlmSettingsSection } from "../components/settings/llm-settings-section";
import { useConnection } from "../hooks/use-connection";
import { ConnectionBadge } from "../components/ConnectionBadge";
import { useAuth, deleteAccount } from "../hooks/use-auth";
import { getApiBaseUrl } from "../lib/api-base";
import { formatLastRefreshed } from "../../../lib/last-refreshed";
import { buildBackup, parseBackup, applyBackup } from "../../../lib/backup";
import { watchlistToCsv } from "../../../lib/csv";
import { externalLinkHandler } from "../lib/open-external";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function Settings() {
  const { settings, loading, update } = useSettings();
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const checkInterval = settings?.checkInterval;
  const prevIntervalRef = useRef<string | undefined>(checkInterval);
  useEffect(() => {
    const prev = prevIntervalRef.current;
    prevIntervalRef.current = checkInterval;
    let cancelled = false;
    (async () => {
      // Sequence stop BEFORE start. Firing both without awaiting let the start
      // be processed first (seeing POLLER_RUNNING=true and no-op'ing) and the
      // stop second, leaving no poller at all until the setting changed again.
      if (!checkInterval || checkInterval === "manual") {
        if (prev && prev !== "manual") await stopPricePoller();
        return;
      }
      if (prev && prev !== "manual" && prev !== checkInterval) {
        await stopPricePoller();
      }
      const intervalMinutes = checkInterval === "hourly" ? 60 : 1440;
      try {
        await startPricePoller(intervalMinutes, getApiBaseUrl());
      } catch {
        if (cancelled) return;
        showToast("Couldn't start background checks — reverted to Manual");
        log.error("[Settings] startPricePoller failed, reverting to manual");
        await update({ checkInterval: "manual" });
      }
    })();
    return () => { cancelled = true; };
  }, [checkInterval, showToast, update]);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [importExportMessage, setImportExportMessage] = useState<string | null>(
    null,
  );
  const { user, isAuthenticated, logout } = useAuth();
  const connection = useConnection();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const installedHandler = () => setDeferredPrompt(null);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setDeferredPrompt(null);
    } catch (e) {
      log.warn("[Settings] install prompt failed", e);
    }
  };

  // Device management — desktop port of mobile DeviceManagementSection
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const handleShareWatchlist = async () => {
    if (sharing) return;
    setSharing(true);
    setShareError(null);
    try {
      const client = (await import("../lib/trpc")).createTRPCClient();
      const res = await client.sharedWatchlists.create.mutate({});
      setShareUrl(res.shareUrl);
      try {
        await navigator.clipboard.writeText(res.shareUrl);
        showToast("Share link copied");
      } catch {
        showToast("Share link created");
      }
    } catch (e) {
      setShareError(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  // Loading guard lives just before the main return below so every render
  // calls the same hooks (Rules of Hooks).

  const currencies = Object.keys(EXCHANGE_RATES);

  const handleExport = async () => {
    try {
      const result = await exportWatchlistAsJson();
      setImportExportMessage(result);
    } catch {
      setImportExportMessage("Export failed");
    }
  };

  const handleImport = async () => {
    try {
      const result = await importWatchlistFromJson();
      setImportExportMessage(result);
    } catch {
      setImportExportMessage("Import failed");
    }
  };

  const handleExportCsv = useCallback(async () => {
    try {
      const [watchlist, appSettings] = await Promise.all([
        storage.getWatchlist(),
        storage.getSettings(),
      ]);
      const csv = watchlistToCsv(watchlist, appSettings.displayCurrency ?? "USD");
      const fileName = `product-stock-finder-watchlist-${new Date().toISOString().slice(0, 10)}.csv`;
      const result = await saveCsv(fileName, csv);
      if (result.status === "cancelled") {
        setImportExportMessage("Export cancelled");
        return;
      }
      if (result.status === "failed") {
        setImportExportMessage("CSV export failed");
        return;
      }
      setImportExportMessage(result.path ? `Exported to ${result.path}` : "Watchlist exported as CSV");
    } catch (e) {
      setImportExportMessage(e instanceof Error ? e.message : "CSV export failed");
    }
  }, []);

  const handleExportBackup = useCallback(async () => {
    try {
      const [watchlist, alerts, reminders, stockWatches, settings] = await Promise.all([
        storage.getWatchlist(),
        storage.getAlerts(),
        storage.getBackOrderReminders(),
        storage.getStockWatches(),
        storage.getSettings(),
      ]);
      const json = buildBackup({ watchlist, alerts, reminders, stockWatches, settings });
      const fileName = `product-stock-finder-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (isTauri()) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeFile } = await import("@tauri-apps/plugin-fs");
        const filePath = await save({ defaultPath: fileName, filters: [{ name: "JSON", extensions: ["json"] }] });
        if (!filePath) {
          setImportExportMessage("Export cancelled");
          return;
        }
        await writeFile(filePath, new TextEncoder().encode(json));
        setImportExportMessage(`Exported to ${filePath}`);
      } else {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setImportExportMessage("Backup downloaded");
      }
    } catch (e) {
      setImportExportMessage(e instanceof Error ? e.message : "Backup export failed");
    }
  }, []);

  const handleImportBackup = useCallback(async () => {
    try {
      let contents: string | null = null;
      if (isTauri()) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const picked = await open({ filters: [{ name: "JSON", extensions: ["json"] }], multiple: false });
        if (!picked) {
          setImportExportMessage("Import cancelled");
          return;
        }
        const bytes = await readFile(picked as string);
        contents = new TextDecoder().decode(bytes);
      } else {
        contents = await new Promise<string | null>((resolve) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "application/json,.json";
          input.onchange = () => {
            const file = input.files?.[0];
            if (!file) {
              resolve(null);
              return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsText(file);
          };
          input.click();
        });
        if (!contents) {
          setImportExportMessage("Import cancelled");
          return;
        }
      }
      const backup = parseBackup(contents);
      if (!backup) {
        setImportExportMessage("That file is not a valid Product Stock Finder backup.");
        return;
      }
      const [watchlist, alerts, reminders, stockWatches, settings] = await Promise.all([
        storage.getWatchlist(),
        storage.getAlerts(),
        storage.getBackOrderReminders(),
        storage.getStockWatches(),
        storage.getSettings(),
      ]);
      const result = applyBackup(backup, { watchlist, alerts, reminders, stockWatches, settings });
      const summary = [
        `Watchlist: +${result.counts.watchlistAdded} new, ${result.counts.watchlistUpdated} updated`,
        `Alerts: +${result.counts.alertsAdded} new, ${result.counts.alertsUpdated} updated`,
        `Reminders: +${result.counts.remindersAdded} new, ${result.counts.remindersUpdated} updated`,
        `Stock watches: +${result.counts.stockWatchesAdded} new, ${result.counts.stockWatchesUpdated} updated`,
      ].join("\n");
      if (!confirm(`Import Backup?\n\n${summary}`)) return;
      // Re-read and merge at save time: the snapshot above predates the confirm
      // dialog, and a price sweep or sync pull can write the watchlist while the
      // user decides — saving the stale snapshot reverted those changes.
      const [freshWatchlist, freshAlerts, freshReminders, freshWatches, freshSettings] =
        await Promise.all([
          storage.getWatchlist(),
          storage.getAlerts(),
          storage.getBackOrderReminders(),
          storage.getStockWatches(),
          storage.getSettings(),
        ]);
      const fresh = applyBackup(backup, {
        watchlist: freshWatchlist,
        alerts: freshAlerts,
        reminders: freshReminders,
        stockWatches: freshWatches,
        settings: freshSettings,
      });
      const now = Date.now();
      // Stamp each collection's meta right after its save, so a later failure
      // cannot leave imported data that never syncs.
      await storage.saveWatchlist(fresh.watchlist);
      for (const idc of fresh.touchedIds.watchlist) await storage.setItemSyncMeta("watchlist", idc, now);
      await storage.saveAlerts(fresh.alerts);
      for (const idc of fresh.touchedIds.alerts) await storage.setItemSyncMeta("alerts", idc, now);
      await storage.saveBackOrderReminders(fresh.reminders);
      for (const idc of fresh.touchedIds.reminders) await storage.setItemSyncMeta("reminders", idc, now);
      await storage.saveStockWatches(fresh.stockWatches);
      for (const idc of fresh.touchedIds.stockWatches) await storage.setItemSyncMeta("reminders", idc, now);
      if (fresh.settingsApplied) await storage.saveSettings(fresh.settings);
      setImportExportMessage("Backup imported. Reloading…");
      window.location.reload();
    } catch (e) {
      setImportExportMessage(e instanceof Error ? e.message : "Backup import failed");
    }
  }, []);

  const handleClearAllData = async () => {
    try {
      await storage.clearAllData();
      setClearConfirm(false);
      window.location.reload();
    } catch (e) {
      // A storage failure must not reject unhandled with no feedback.
      setImportExportMessage(e instanceof Error ? e.message : "Couldn't clear data. Please try again.");
      setClearConfirm(false);
    }
  };

  const handleDeleteAccount = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      try {
        logout();
      } catch {
        // token is removed by the wipe below regardless
      }
      await storage.clearAllData();
      window.location.reload();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Server account deletion failed");
    } finally {
      setDeleting(false);
    }
  }, [deleting, logout]);

  const deleteExpected = user?.email ?? "DELETE";
  const isDeleteConfirmed =
    user?.email != null
      ? deleteConfirmEmail.trim().toLowerCase() === deleteExpected.toLowerCase()
      : deleteConfirmEmail.trim() === deleteExpected;

  if (loading || !settings) return <LoadingSpinner />;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      {toast && <div role="status" className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-[60]">{toast}</div>}

      {/* Connection Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">Connection</h2>
        <div className="flex items-center justify-between gap-4">
          <ConnectionBadge status={connection.status} />
          <button
            onClick={() => connection.refetch()}
            disabled={connection.isRefreshing}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium disabled:opacity-50"
            aria-label="Check connection now"
          >
            {connection.isRefreshing ? "Checking" : "Check Now"}
          </button>
        </div>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {connection.status === "connected"
            ? "Live price checks are active."
            : connection.status === "signed-out"
              ? "Sign in to sync prices with the backend."
              : "Backend unreachable. Showing saved prices."}
        </p>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          {connection.lastCheckedAt
            ? `Last checked ${formatLastRefreshed(new Date(connection.lastCheckedAt).toISOString())}`
            : "Never checked"}
        </p>
      </div>

      <AccountSection now={now} showToast={showToast} />

      <button
        onClick={() => navigate("/health")}
        className="flex items-center gap-2 w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-brand-500 transition-colors"
        aria-label="View distributor health"
      >
        <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        <span className="text-left">
          <span className="block text-lg font-semibold">
            Distributor Health
          </span>
          <span className="block text-sm text-gray-500 dark:text-gray-400">
            View scraper status and run a live check
          </span>
        </span>
      </button>

      <ScraperStatusSection now={now} showToast={showToast} />

      <DeviceManagementSection
        isAuthenticated={isAuthenticated}
        showToast={showToast}
      />

      {/* Share Watchlist — desktop port of mobile SharedWatchlists */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-3">
          <Share2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Collaborative Watchlist</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Create a read-only public link to your watchlist. Anyone with the link can view it.</p>
        {!isAuthenticated ? (
          <p className="text-sm text-gray-500">Sign in to share your watchlist.</p>
        ) : (
          <>
            <button onClick={handleShareWatchlist} disabled={sharing} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50" aria-label="Create share link">
              {sharing ? "Creating link…" : "Share watchlist"}
            </button>
            {shareUrl && (
              <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 break-all">
                <p className="text-xs text-gray-500 mb-1">Share link (expires in 30 days):</p>
                <a href={shareUrl} target="_blank" rel="noopener noreferrer" onClick={externalLinkHandler(shareUrl)} className="text-sm text-brand-600 hover:underline break-all">{shareUrl}</a>
                <button onClick={() => { navigator.clipboard.writeText(shareUrl).then(() => showToast("Copied")).catch(() => showToast("Couldn't copy link")); }} className="ml-2 text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800">Copy</button>
              </div>
            )}
            {shareError && <p className="text-sm text-amber-600 mt-2">{shareError}</p>}
            <SharedLinksList />
            <JoinedSharedList />
          </>
        )}
      </div>

      {/* Theme Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Palette className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Theme</h2>
        </div>
        <div className="flex gap-2">
          {(["light", "dark", "auto"] as const).map((t) => (
            <button
              key={t}
              onClick={() => update({ theme: t })}
              aria-pressed={settings.theme === t}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                settings.theme === t
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              aria-label={`Set theme to ${t}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Currency Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Display Currency</h2>
        </div>
        <select
          value={settings.displayCurrency}
          onChange={(e) => update({ displayCurrency: e.target.value })}
          className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm shadow-sm dark:shadow-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
          aria-label="Display currency"
        >
          {currencies.map((currency) => (
            <option key={currency} value={currency}>
              {currency} ({CURRENCY_SYMBOLS[currency]})
            </option>
          ))}
        </select>
      </div>

      {/* Shipping Region Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Shipping Region</h2>
        </div>
        <select
          value={settings.shippingRegion ?? "Asia-Pacific"}
          onChange={(e) => update({ shippingRegion: e.target.value })}
          className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm shadow-sm dark:shadow-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
          aria-label="Shipping region"
        >
          {[
            "Asia-Pacific",
            "Europe",
            "North America",
            "Middle East",
            "Africa",
          ].map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      </div>

      {/* Check Interval Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Check Interval</h2>
        </div>
        <div className="flex gap-2">
          {([
            { value: "manual", label: "Manual only" },
            { value: "hourly", label: "Every hour" },
            { value: "daily", label: "Once a day" },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => update({ checkInterval: value })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                settings.checkInterval === value
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              aria-label={`Set check interval to ${label}`}
              aria-pressed={settings.checkInterval === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <NotificationSettingsSection
        settings={settings}
        update={update}
        isAuthenticated={isAuthenticated}
        showToast={showToast}
      />

      <LlmSettingsSection
        settings={settings}
        update={update}
        showToast={showToast}
      />

      {/* Price Digest Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">Price Digest</h2>
        <div className="flex gap-2">
          {(["off", "daily", "weekly"] as const).map((freq) => (
            <button
              key={freq}
              onClick={() => update({ digestFrequency: freq })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                (settings.digestFrequency ?? "off") === freq
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              aria-label={`Set digest frequency to ${freq}`}
              aria-pressed={(settings.digestFrequency ?? "off") === freq}
            >
              {freq.charAt(0).toUpperCase() + freq.slice(1)}
            </button>
          ))}
        </div>
        {settings.digestFrequency === "weekly" && (
          <div className="flex gap-2 mt-2">
            {DAY_LABELS.map((day, index) => (
              <button
                key={day}
                onClick={() => update({ digestDayOfWeek: index })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  DAY_LABELS[settings.digestDayOfWeek ?? 0] === day
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
                aria-label={`Set digest day to ${day}`}
                aria-pressed={DAY_LABELS[settings.digestDayOfWeek ?? 0] === day}
              >
                {day}
              </button>
            ))}
          </div>
        )}
      </div>



      {/* Import/Export Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">Data</h2>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
            aria-label="Export watchlist"
          >
            <Download className="w-4 h-4" /> Export Watchlist
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            aria-label="Import watchlist"
          >
            <Upload className="w-4 h-4" /> Import Watchlist
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            aria-label="Export CSV"
            title="Save watchlist as CSV (prices in display currency)"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
            aria-label="Export Backup"
            title="Save watchlist, alerts and settings to a file"
          >
            <Download className="w-4 h-4" /> Export Backup
          </button>
          <button
            onClick={handleImportBackup}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            aria-label="Import Backup"
            title="Restore from a backup file (merges by id)"
          >
            <Upload className="w-4 h-4" /> Import Backup
          </button>
        </div>
        {importExportMessage && (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {importExportMessage}
          </p>
        )}
      </div>

      {/* Clear All Data Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">Danger Zone</h2>
        {isAuthenticated && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {/* A signed-in device re-syncs: clearing the local cursor makes the
                next sync pull everything back, so the button looked broken. */}
            Signed in: this clears this device&apos;s copy only. Your account&apos;s data
            stays on the server and re-syncs — use &quot;Delete Account &amp; Data&quot;
            to remove it everywhere.
          </p>
        )}
        {!clearConfirm ? (
          <button
            onClick={() => setClearConfirm(true)}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
            aria-label="Clear all data"
          >
            <Trash2 className="w-4 h-4" /> Clear All Data
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-600 dark:text-red-400">
              Are you sure?
            </span>
            <button
              onClick={handleClearAllData}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
              aria-label="Confirm clear all data"
            >
              Yes, clear all
            </button>
            <button
              onClick={() => setClearConfirm(false)}
              disabled={deleting}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
              aria-label="Cancel clear all data"
            >
              Cancel
            </button>
          </div>
        )}
          {isAuthenticated && user && (
            <div className="mt-4">
              {!deleteConfirm ? (
                <button
                  onClick={() => { setDeleteConfirmEmail(""); setDeleteConfirm(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  aria-label="Delete account and data"
                >
                  <Trash2 className="w-4 h-4" /> Delete Account & Data
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    This permanently deletes your server account and all local data. This cannot be undone.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {user?.email
                      ? `Type your email (${user.email}) to confirm.`
                      : "Type DELETE to confirm."}
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmEmail}
                    onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                    placeholder={user?.email ? "Your email address" : "DELETE"}
                    className="w-full max-w-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    aria-label="Type to confirm account deletion"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting || !isDeleteConfirmed}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                      aria-label="Confirm delete account and data"
                    >
                      {deleting ? "Deleting" : "Yes, delete everything"}
                    </button>
                    <button
                      onClick={() => { setDeleteConfirmEmail(""); setDeleteConfirm(false); }}
                      disabled={deleting}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
                      aria-label="Cancel delete account and data"
                    >
                      Cancel
                    </button>
                  </div>
                  {deleteError && (
                    <p className="text-sm text-red-600 dark:text-red-400" role="alert">{deleteError}</p>
                  )}
                </div>
              )}
            </div>
          )}
      </div>

      <AboutSection
        deferredPrompt={deferredPrompt}
        onInstall={handleInstall}
      />
    </div>
  );
}
