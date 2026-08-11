import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Palette, DollarSign, Bell, Clock, Download, Upload, Trash2, Activity, Globe } from "lucide-react";
import { useSettings } from "../hooks/use-storage";
import { useTheme } from "../hooks/use-theme";
import { storage } from "../storage";
import { startPricePoller, stopPricePoller } from "../background";
import { EXCHANGE_RATES, CURRENCY_SYMBOLS } from "../../../lib/currency";
import { exportWatchlistAsJson, importWatchlistFromJson } from "../import-export";
import { LoadingSpinner } from "../components/LoadingSpinner";

export function Settings() {
  const { settings, loading, update } = useSettings();
  const { set: setTheme } = useTheme();
  const navigate = useNavigate();
  useEffect(() => {
    if (!settings || settings.checkInterval === "manual") return;
    const intervalMinutes =
      settings.checkInterval === "hourly" ? 60 : 1440;
    startPricePoller(intervalMinutes);
    return () => {
      stopPricePoller();
    };
  }, [settings?.checkInterval]);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [importExportMessage, setImportExportMessage] = useState<string | null>(null);

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

      <button
        onClick={() => navigate("/health")}
        className="flex items-center gap-2 w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-brand-500 transition-colors"
      >
        <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        <span className="text-left">
          <span className="block text-lg font-semibold">Distributor Health</span>
          <span className="block text-sm text-gray-500 dark:text-gray-400">
            View scraper status and run a live check
          </span>
        </span>
      </button>

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
              onClick={() => {
                setTheme(t);
                update({ theme: t });
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                settings.theme === t
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
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
          className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
          className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {["Asia-Pacific", "Europe", "North America", "Middle East", "Africa"].map((region) => (
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
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium">Enable Notifications</span>
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(e) => update({ notificationsEnabled: e.target.checked })}
              className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium">Stock Alerts</span>
            <input
              type="checkbox"
              checked={settings.stockAlerts}
              onChange={(e) => update({ stockAlerts: e.target.checked })}
              className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium">Price Alerts</span>
            <input
              type="checkbox"
              checked={settings.priceAlerts}
              onChange={(e) => update({ priceAlerts: e.target.checked })}
              className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
            />
          </label>
        </div>
      </div>

      {/* Import/Export Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">Data Management</h2>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" /> Export Watchlist
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            <Upload className="w-4 h-4" /> Import Watchlist
          </button>
        </div>
        {importExportMessage && (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{importExportMessage}</p>
        )}
      </div>

      {/* Clear All Data Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">Danger Zone</h2>
        {!clearConfirm ? (
          <button
            onClick={() => setClearConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" /> Clear All Data
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-600 dark:text-red-400">Are you sure?</span>
            <button
              onClick={handleClearAllData}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Yes, clear all
            </button>
            <button
              onClick={() => setClearConfirm(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}