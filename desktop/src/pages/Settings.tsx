import { useNavigate } from "react-router";
import {
  Palette,
  DollarSign,
  Clock,
  Activity,
  Globe,
  Share2,
} from "lucide-react";
import { useSettings } from "../hooks/use-storage";
import { useToast } from "../hooks/use-toast";
import { EXCHANGE_RATES, CURRENCY_SYMBOLS } from "@shared/currency";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { SharedLinksList, JoinedSharedList } from "../components/settings/shared-links";
import { ScraperStatusSection } from "../components/settings/scraper-status-section";
import { DeviceManagementSection } from "../components/settings/device-management-section";
import { AboutSection } from "../components/settings/about-section";
import { AccountSection } from "../components/settings/account-section";
import { NotificationSettingsSection } from "../components/settings/notification-settings-section";
import { LlmSettingsSection } from "../components/settings/llm-settings-section";
import { DataSettingsSection } from "../components/settings/data-settings-section";
import { DangerZoneSection } from "../components/settings/danger-zone-section";
import { useConnection } from "../hooks/use-connection";
import { ConnectionBadge } from "../components/ConnectionBadge";
import { useAuth } from "../hooks/use-auth";
import { usePricePoller } from "../hooks/use-price-poller";
import { useNow } from "../hooks/use-now";
import { useInstallPrompt } from "../hooks/use-install-prompt";
import { useShareWatchlist } from "../hooks/use-share-watchlist";
import { formatLastRefreshed } from "../../../lib/last-refreshed";
import { externalLinkHandler } from "../lib/open-external";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function Settings() {
  const { settings, loading, update } = useSettings();
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const checkInterval = settings?.checkInterval;
  usePricePoller({ checkInterval, update, showToast });
  const { user, isAuthenticated, logout } = useAuth();
  const connection = useConnection();
  const now = useNow();
  const { deferredPrompt, handleInstall } = useInstallPrompt();
  const { shareUrl, sharing, shareError, handleShareWatchlist } =
    useShareWatchlist({ showToast });

  // Loading guard lives just before the main return below so every render
  // calls the same hooks (Rules of Hooks).

  const currencies = Object.keys(EXCHANGE_RATES);

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

      <ScraperStatusSection showToast={showToast} />

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



      <DataSettingsSection />

      <DangerZoneSection
        isAuthenticated={isAuthenticated}
        user={user}
        showToast={showToast}
        onSignOut={logout}
      />

      <AboutSection
        deferredPrompt={deferredPrompt}
        onInstall={handleInstall}
      />
    </div>
  );
}
