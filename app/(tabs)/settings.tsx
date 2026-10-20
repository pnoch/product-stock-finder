import { log } from "@shared/log";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { PaywallScreen } from "@/components/paywall/paywall-screen";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/lib/settings-provider";
import { useColors } from "@/hooks/use-colors";
import { useEntitlements } from "@/hooks/use-entitlements";
import { useServerConfig } from "@/hooks/use-server-config";
import { track } from "@/lib/telemetry";
import { getWatchlist } from "@/lib/storage";
import { maybeRefreshFxRates } from "@/lib/fx";
import { AppSettings, Product } from "@/lib/types";
import { showAlert } from "@/lib/alert";
import { sendTestNotification } from "@/lib/notifications";
import {
  checkPriceDropsNow,
  registerPriceCheckTask,
  syncBackgroundTasks,
} from "@/lib/background-price-check";
import { useMonitoringHealth } from "@/hooks/use-monitoring-health";

import { ConnectionSection } from "@/components/settings/connection-section";
import { AccountSection } from "@/components/settings/account-section";
import { DeviceManagementSection } from "@/components/settings/device-management-section";
import { DataSection } from "@/components/settings/data-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { ScraperStatusSection } from "@/components/settings/scraper-status-section";
import { LlmSettingsSection } from "@/components/settings/llm-settings-section";
import { AboutSection } from "@/components/settings/about-section";
import { SiteSessionsSection } from "@/components/settings/site-sessions-section";
import { BackgroundRefreshSection } from "@/components/settings/background-refresh-section";
import { DisplaySection } from "@/components/settings/display-section";
import { MonitoringSection } from "@/components/settings/monitoring-section";
import { CollaborativeWatchlistSection } from "@/components/settings/collaborative-watchlist-section";
import { ProSection } from "@/components/settings/pro-section";
import { useSettingsSync } from "@/hooks/use-settings-sync";
import { LoginModal } from "@/components/settings/login-modal";
import { SectionHeader } from "@/components/settings/section-header";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { configured } = useServerConfig();
  const {
    settings,
    loading: settingsLoading,
    updateSetting: saveSetting,
    refresh: refreshSettings,
  } = useSettings();
  const [webNotificationHint, setWebNotificationHint] = useState<string | null>(
    null,
  );
  const [products, setProducts] = useState<Product[]>([]);
  const { user, isAuthenticated, logout, login, register } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const loading = settingsLoading || watchlistLoading;
  const [reenabling, setReenabling] = useState(false);
  const { isPro } = useEntitlements();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const { health: monitoring, refresh: refreshMonitoring } = useMonitoringHealth();
  const { syncMeta, syncing, syncStatus, handleSyncNow } = useSettingsSync(
    isAuthenticated,
    configured,
  );

  const openPaywall = useCallback(() => {
    track("paywall_shown");
    setPaywallVisible(true);
  }, []);

  const handleSignIn = useCallback(() => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowLoginModal(true);
  }, []);

  const reloadData = useCallback(async () => {
    try {
      const [, p] = await Promise.all([refreshSettings(), getWatchlist()]);
      setProducts(p);
    } catch (e) {
      log.error("[Settings] reload failed", e);
    }
  }, [refreshSettings]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getWatchlist();
        if (!cancelled) setProducts(p);
      } catch (e) {
        log.error("[Settings] load failed", e);
      } finally {
        if (!cancelled) setWatchlistLoading(false);
      }
      void maybeRefreshFxRates().catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSetting = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      try {
        await saveSetting(key, value);
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert("Failed to save", "Could not save setting. Please try again.");
        return;
      }
      if (key === "checkInterval") {
        void syncBackgroundTasks();
      }
    },
    [saveSetting],
  );

  const handleTestNotification = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const sent = await sendTestNotification();
    if (!sent) {
      showAlert(
        "Permission Required",
        "Please enable notifications in your device settings to receive stock and price alerts.",
        [{ text: "OK" }],
      );
    }
  }, []);

  const handleReenableDistributor = useCallback(
    async (distributorId: string) => {
      if (reenabling) return;
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setReenabling(true);
      try {
        // Only clear the circuit breaker so the next price check attempts the
        // fetch again. Do NOT stamp lastChecked here: that field means "last
        // successful check" (refresh-listing.ts writes it only on a successful
        // parse), so stamping it made a Failed distributor show "OK / Last
        // checked: today" with no prices actually fetched.
        const { clearDistributorBreaker } = await import("@/lib/scrapers/breaker-clear");
        await clearDistributorBreaker(distributorId);
      } catch (e) {
        log.error("[Settings] handleReenableDistributor failed", e);
        showAlert("Failed", "Could not re-enable distributor. Please try again.");
      } finally {
        setReenabling(false);
      }
    },
    [reenabling],
  );

  const handleReenableMonitoring = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await registerPriceCheckTask();
      // A stale task is already registered; re-registering won't refresh the
      // last-run timestamp, so run a foreground check to clear `stale`.
      if (monitoring.status === "stale") {
        await checkPriceDropsNow();
      }
      await refreshMonitoring();
    } catch (e) {
      log.error("[Settings] handleReenableMonitoring failed", e);
      showAlert("Failed", "Could not re-enable background monitoring. Please try again.");
    }
  }, [refreshMonitoring, monitoring.status]);

  const regions = [
    "Asia-Pacific",
    "Europe",
    "North America",
    "Middle East",
    "Africa",
  ];
  const intervals = [
    { value: "manual", label: "Manual only" },
    { value: "hourly", label: "Every hour" },
    { value: "daily", label: "Once a day" },
  ];

  if (loading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}>
        <View className="px-4 pt-4 pb-2">
          <Text className="text-2xl font-bold text-foreground">Settings</Text>
        </View>

        <ConnectionSection />

        {configured ? (
          <>
            <AccountSection
              isAuthenticated={isAuthenticated}
              user={user}
              syncMeta={syncMeta}
              syncing={syncing}
              onSyncNow={handleSyncNow}
              onSignOut={logout}
              onSignIn={handleSignIn}
              syncStatus={syncStatus}
            />

            <DeviceManagementSection
              user={user}
              isAuthenticated={isAuthenticated}
              colors={colors}
            />
          </>
        ) : (
          <Text
            style={{
              color: colors.muted,
              fontSize: 13,
              marginHorizontal: 16,
              marginTop: 8,
              lineHeight: 18,
            }}
          >
            Local-only mode — prices are fetched directly from distributors on
            this device. Sign-in and cross-device sync are unavailable.
          </Text>
        )}

        <DataSection />

        <NotificationsSection
          key={settings.alertWebhookUrl ?? ""}
          settings={settings}
          updateSetting={updateSetting}
          onTestNotification={handleTestNotification}
          webNotificationHint={webNotificationHint}
          setWebNotificationHint={setWebNotificationHint}
        />

        <SectionHeader title="Background Refresh" />
        <BackgroundRefreshSection
          settings={settings}
          updateSetting={updateSetting}
          isPro={isPro}
          openPaywall={openPaywall}
          monitoring={monitoring}
          onReenableMonitoring={handleReenableMonitoring}
        />

        <DisplaySection settings={settings} updateSetting={updateSetting} />

        <MonitoringSection
          settings={settings}
          updateSetting={updateSetting}
          regions={regions}
          intervals={intervals}
        />

        <ScraperStatusSection
          products={products}
          onReenableDistributor={handleReenableDistributor}
        />

        <LlmSettingsSection
          key={`${settings.llmApiKey ?? ""}|${settings.llmModel ?? ""}|${settings.llmOllamaUrl ?? ""}`}
          settings={settings}
          onUpdate={updateSetting}
        />

        <CollaborativeWatchlistSection
          isAuthenticated={isAuthenticated}
          onSignIn={handleSignIn}
        />

        <ProSection onUpgrade={openPaywall} />

        <AboutSection onDataCleared={reloadData} />
        <SiteSessionsSection />
      </ScrollView>

      <PaywallScreen
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />

      <LoginModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={login}
        onRegister={register}
      />
    </ScreenContainer>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
