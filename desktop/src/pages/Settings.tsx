import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Palette,
  DollarSign,
  Bell,
  Clock,
  Download,
  Upload,
  Trash2,
  Activity,
  Globe,
  UserCircle,
  MonitorSmartphone,
  Share2,
  Pencil,
  LogOut,
  X,
} from "lucide-react";
import { useSettings } from "../hooks/use-storage";
import { storage } from "../storage";
import { startPricePoller, stopPricePoller } from "../background";
import { EXCHANGE_RATES, CURRENCY_SYMBOLS } from "@shared/currency";
import {
  exportWatchlistAsJson,
  importWatchlistFromJson,
} from "../import-export";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth, buildLoginUrl } from "../hooks/use-auth";
import { getApiBaseUrl } from "../lib/api-base";
import { trpc } from "../lib/trpc";
import { getDesktopDeviceId } from "../lib/device-id";

export function Settings() {
  const { settings, loading, update } = useSettings();
  const navigate = useNavigate();
  const prevIntervalRef = useRef<string | undefined>(settings?.checkInterval);
  useEffect(() => {
    const prev = prevIntervalRef.current;
    prevIntervalRef.current = settings?.checkInterval;
    if (!settings || settings.checkInterval === "manual") {
      if (prev && prev !== "manual") stopPricePoller();
      return;
    }
    if (prev && prev !== "manual" && prev !== settings.checkInterval) {
      stopPricePoller();
    }
    const intervalMinutes = settings.checkInterval === "hourly" ? 60 : 1440;
    startPricePoller(intervalMinutes, getApiBaseUrl());
  }, [settings?.checkInterval]);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [importExportMessage, setImportExportMessage] = useState<string | null>(
    null,
  );
  const { user, isAuthenticated, login, logout } = useAuth();
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const refresh = async () => {
      const meta = await storage.getSyncMeta();
      if (!cancelled) {
        setLastSyncedAt(meta.lastSyncedAt || null);
        setNow(Date.now());
      }
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  const syncStatus = !isAuthenticated
    ? "Sign in to sync across devices"
    : !lastSyncedAt
      ? "Not synced yet"
      : (() => {
          const minutes = Math.floor((now - lastSyncedAt) / 60000);
          if (minutes < 1) return "Synced just now";
          if (minutes < 60) return `Last synced ${minutes}m ago`;
          return `Last synced ${Math.floor(minutes / 60)}h ago`;
        })();

  const handleSignIn = async () => {
    await login(buildLoginUrl());
  };

  // Device management — desktop port of mobile DeviceManagementSection
  const [devices, setDevices] = useState<{ deviceId: string; label: string | null; lastActiveAt: string | null }[] | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ deviceId: string; label: string | null } | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
  const trpcClient = trpc as any;

  const loadDevices = async () => {
    if (!isAuthenticated) return;
    setDevicesLoading(true);
    setDevicesError(null);
    try {
      const [devRes, curId] = await Promise.all([
        (trpcClient.devices?.list ? trpcClient.devices.list.query() : (await import("../lib/trpc")).createTRPCClient().devices.list.query()) as Promise<{ devices: { deviceId: string; label: string | null; lastActiveAt: string | null }[] }>,
        getDesktopDeviceId(),
      ]);
      setDevices(devRes?.devices ?? []);
      setCurrentDeviceId(curId);
    } catch (e) {
      setDevicesError(e instanceof Error ? e.message : String(e));
      setDevices(null);
    } finally {
      setDevicesLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadDevices();
  }, [isAuthenticated]);

  const handleRename = async () => {
    if (!renameTarget) return;
    const label = renameLabel.trim();
    if (!label) return;
    setRenaming(true);
    try {
      const client = (await import("../lib/trpc")).createTRPCClient();
      await client.devices.rename.mutate({ deviceId: renameTarget.deviceId, label });
      setRenameTarget(null);
      setRenameLabel("");
      await loadDevices();
      showToast("Device renamed");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setRenaming(false);
    }
  };

  const handleSignOutDevice = async (deviceId: string) => {
    if (!confirm("Sign out this device and remove it from your account?")) return;
    try {
      const client = (await import("../lib/trpc")).createTRPCClient();
      await client.devices.signOut.mutate({ deviceId });
      await loadDevices();
      showToast("Device signed out");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sign out failed");
    }
  };

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

  if (loading || !settings) return <LoadingSpinner />;

  const currencies = Object.keys(EXCHANGE_RATES);

  const handleExport = async () => {
    try {
      const result = await exportWatchlistAsJson();
      setImportExportMessage(result);
    } catch (error) {
      setImportExportMessage("Export failed");
    }
  };

  const handleImport = async () => {
    try {
      const result = await importWatchlistFromJson();
      setImportExportMessage(result);
    } catch (error) {
      setImportExportMessage("Import failed");
    }
  };

  const handleClearAllData = async () => {
    await storage.clearAllData();
    setClearConfirm(false);
    window.location.reload();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      {toast && <div className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-[60]">{toast}</div>}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <UserCircle className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Account</h2>
        </div>
        {isAuthenticated && user ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{user.name ?? "Signed in"}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {user.email ?? user.openId}
              </p>
              <p className="text-xs text-gray-400 mt-1">{syncStatus}</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              aria-label="Sign out"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Sign in to sync</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {syncStatus}
              </p>
            </div>
            <button
              onClick={handleSignIn}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
              aria-label="Sign in"
            >
              Sign in
            </button>
          </div>
        )}
      </div>

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

      {/* Device Management Section — desktop port */}
      {isAuthenticated && user && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3 mb-4">
            <MonitorSmartphone className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <h2 className="text-lg font-semibold">Device Management</h2>
            <button onClick={loadDevices} className="ml-auto text-xs text-brand-600 hover:underline" aria-label="Reload devices">Refresh</button>
          </div>
          {!devices && devicesLoading ? (
            <p className="text-sm text-gray-500">Loading devices…</p>
          ) : devicesError ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-amber-600">{devicesError}</p>
              <button onClick={loadDevices} className="text-sm text-brand-600 font-medium hover:underline">Retry</button>
            </div>
          ) : devices && devices.length === 0 ? (
            <p className="text-sm text-gray-500">No other devices bound to your account.</p>
          ) : devices ? (
            <div className="space-y-2">
              {devices.map((d) => {
                const isCurrent = d.deviceId === currentDeviceId;
                return (
                  <div key={d.deviceId} className={`flex items-center justify-between p-3 rounded-lg border ${isCurrent ? "border-brand-200 bg-brand-50 dark:bg-brand-900/10 dark:border-brand-800" : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30"}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.label ?? `${d.deviceId.slice(0, 12)}…`}{isCurrent && " (current)"}</p>
                      <p className="text-xs text-gray-500 truncate">{d.deviceId}</p>
                      {d.lastActiveAt && <p className="text-xs text-gray-400">Active {new Date(d.lastActiveAt).toLocaleDateString()}</p>}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button onClick={() => { setRenameTarget(d); setRenameLabel(d.label ?? ""); }} className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-600" aria-label={`Rename ${d.label ?? d.deviceId}`} title="Rename">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!isCurrent && (
                        <button onClick={() => handleSignOutDevice(d.deviceId)} className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20" aria-label={`Sign out ${d.label ?? d.deviceId}`} title="Sign out">
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          {renameTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRenameTarget(null)}>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Rename device</h3>
                  <button onClick={() => setRenameTarget(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
                </div>
                <input value={renameLabel} onChange={(e) => setRenameLabel(e.target.value)} placeholder="Device label" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm mb-3" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setRenameTarget(null)} className="px-3 py-2 rounded-lg border text-sm">Cancel</button>
                  <button onClick={handleRename} disabled={renaming || !renameLabel.trim()} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-50">{renaming ? "Saving…" : "Save"}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Share Watchlist — desktop port of mobile SharedWatchlists */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-3">
          <Share2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Share Watchlist</h2>
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
                <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline break-all">{shareUrl}</a>
                <button onClick={() => { navigator.clipboard.writeText(shareUrl).then(() => showToast("Copied")).catch(() => {}); }} className="ml-2 text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800">Copy</button>
              </div>
            )}
            {shareError && <p className="text-sm text-amber-600 mt-2">{shareError}</p>}
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
          {(["manual", "hourly", "daily"] as const).map((interval) => (
            <button
              key={interval}
              onClick={() => update({ checkInterval: interval })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                settings.checkInterval === interval
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              aria-label={`Set check interval to ${interval}`}
            >
              {interval.charAt(0).toUpperCase() + interval.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Notifications</h2>
        </div>
        <div className="space-y-1">
          <label className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors cursor-pointer">
            <span className="text-sm font-medium">Enable Notifications</span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) =>
                  update({ notificationsEnabled: e.target.checked })
                }
                className="sr-only peer"
                aria-label="Enable notifications"
              />
              <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
            </span>
          </label>
          <label className={`flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors ${settings.notificationsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <span className="text-sm font-medium">Stock Alerts</span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.stockAlerts}
                onChange={(e) => update({ stockAlerts: e.target.checked })}
                disabled={!settings.notificationsEnabled}
                className="sr-only peer"
                aria-label="Enable stock alerts"
              />
              <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
            </span>
          </label>
          <label className={`flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors ${settings.notificationsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <span className="text-sm font-medium">Price Alerts</span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.priceAlerts}
                onChange={(e) => update({ priceAlerts: e.target.checked })}
                disabled={!settings.notificationsEnabled}
                className="sr-only peer"
                aria-label="Enable price alerts"
              />
              <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
            </span>
          </label>
        </div>
      </div>

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
            >
              {freq.charAt(0).toUpperCase() + freq.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Import/Export Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">Data Management</h2>
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
        {!clearConfirm ? (
          <button
            onClick={() => setClearConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
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
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              aria-label="Confirm clear all data"
            >
              Yes, clear all
            </button>
            <button
              onClick={() => setClearConfirm(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              aria-label="Cancel clear all data"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
